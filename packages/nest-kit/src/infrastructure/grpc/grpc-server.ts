import { randomUUID } from 'node:crypto';
import {
  Metadata,
  sendUnaryData,
  Server,
  ServerCredentials,
  ServerUnaryCall,
  status as GrpcStatus,
  UntypedHandleCall,
} from '@grpc/grpc-js';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Actor, assignActor, runWithRequestContext } from '../../common/context/request-context';
import { resolveError } from '../../common/filters/global-exception.filter';
import { KitConfig } from '../../config/kit-config';
import { JwtVerifier } from '../auth/jwt-verifier.service';
import { GrpcContract, serviceDefinitionOf } from './grpc-contract';

export const AUTHORIZATION_METADATA = 'authorization';
export const IDEMPOTENCY_KEY_METADATA = 'idempotency-key';
export const REQUEST_ID_METADATA = 'x-request-id';
export const ERROR_CODE_METADATA = 'error-code';
export const ERROR_DETAILS_METADATA = 'error-details';

const BEARER_PREFIX = 'Bearer ';
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const MAX_ERROR_DETAILS_LENGTH = 4_000;
const SHUTDOWN_GRACE_MS = 5_000;

export interface CommandCall {
  caller: Actor;
  idempotencyKey: string;
  requestId: string;
}

export interface GrpcCommand<Request = never, Reply = unknown> {
  permission: string;
  handle(request: Request, call: CommandCall): Promise<Reply>;
}

class CommandRefused extends Error {
  constructor(
    readonly status: GrpcStatus,
    message: string,
  ) {
    super(message);
  }
}

const HTTP_TO_GRPC: Record<number, GrpcStatus> = {
  400: GrpcStatus.INVALID_ARGUMENT,
  401: GrpcStatus.UNAUTHENTICATED,
  403: GrpcStatus.PERMISSION_DENIED,
  404: GrpcStatus.NOT_FOUND,
  409: GrpcStatus.ALREADY_EXISTS,
  413: GrpcStatus.INVALID_ARGUMENT,
  415: GrpcStatus.INVALID_ARGUMENT,
  422: GrpcStatus.FAILED_PRECONDITION,
  429: GrpcStatus.RESOURCE_EXHAUSTED,
  503: GrpcStatus.UNAVAILABLE,
  504: GrpcStatus.DEADLINE_EXCEEDED,
};

export function grpcStatusFor(httpStatus: number): GrpcStatus {
  return HTTP_TO_GRPC[httpStatus] ?? GrpcStatus.INTERNAL;
}

function firstText(metadata: Metadata, name: string): string {
  const [value] = metadata.get(name);
  return typeof value === 'string' ? value : '';
}

@Injectable()
export class GrpcServer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(GrpcServer.name);
  private readonly server = new Server();
  private boundPort: number | null = null;
  private registered = 0;

  constructor(
    private readonly config: KitConfig,
    private readonly verifier: JwtVerifier,
  ) {}

  get port(): number {
    if (this.boundPort === null) {
      throw new Error('The gRPC server is not listening');
    }
    return this.boundPort;
  }

  isServing(): boolean {
    return !this.shouldListen() || this.boundPort !== null;
  }

  private shouldListen(): boolean {
    return this.registered > 0 && this.config.grpc?.port !== undefined;
  }

  register(
    contract: GrpcContract,
    servicePath: string,
    commands: Record<string, GrpcCommand>,
  ): void {
    const definition = serviceDefinitionOf(contract, servicePath);
    const declared = Object.keys(definition);
    const missing = declared.filter((name) => !commands[name]);
    const extra = Object.keys(commands).filter((name) => !declared.includes(name));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `Commands for ${servicePath} do not match the contract; missing: ${missing.join(', ') || 'none'}, not in contract: ${extra.join(', ') || 'none'}`,
      );
    }
    const handlers: Record<string, UntypedHandleCall> = {};
    for (const name of declared) {
      handlers[name] = this.handlerFor(commands[name] as GrpcCommand);
    }
    this.server.addService(definition, handlers);
    this.registered += 1;
  }

  async onApplicationBootstrap(): Promise<void> {
    const port = this.config.grpc?.port;
    if (!this.shouldListen() || port === undefined) {
      return;
    }
    this.boundPort = await new Promise<number>((resolve, reject) => {
      this.server.bindAsync(
        `0.0.0.0:${port}`,
        ServerCredentials.createInsecure(),
        (error, bound) => (error ? reject(error) : resolve(bound)),
      );
    });
    this.logger.log(`gRPC commands are served on port ${this.boundPort}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boundPort === null) {
      return;
    }
    this.boundPort = null;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.server.forceShutdown();
        resolve();
      }, SHUTDOWN_GRACE_MS);
      this.server.tryShutdown(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private handlerFor(command: GrpcCommand): UntypedHandleCall {
    const handle = (call: ServerUnaryCall<never, unknown>, callback: sendUnaryData<unknown>) => {
      const requestId = firstText(call.metadata, REQUEST_ID_METADATA) || randomUUID();
      runWithRequestContext({ requestId, ip: call.getPeer(), userAgent: null, actor: null }, () => {
        this.run(command, call, requestId).then(
          (reply) => callback(null, reply),
          (error: unknown) => callback(this.toServiceError(error, requestId)),
        );
      });
    };
    return handle as unknown as UntypedHandleCall;
  }

  private async run(
    command: GrpcCommand,
    call: ServerUnaryCall<never, unknown>,
    requestId: string,
  ): Promise<unknown> {
    const caller = await this.authenticate(call.metadata);
    if (!caller.service?.permissions.includes(command.permission)) {
      throw new CommandRefused(GrpcStatus.PERMISSION_DENIED, 'The caller may not run this command');
    }
    const idempotencyKey = firstText(call.metadata, IDEMPOTENCY_KEY_METADATA);
    if (idempotencyKey.length === 0 || idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new CommandRefused(
        GrpcStatus.INVALID_ARGUMENT,
        `Metadata ${IDEMPOTENCY_KEY_METADATA} is required and holds at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`,
      );
    }
    assignActor(caller);
    return command.handle(call.request, { caller, idempotencyKey, requestId });
  }

  private async authenticate(metadata: Metadata): Promise<Actor> {
    const header = firstText(metadata, AUTHORIZATION_METADATA);
    if (!header.startsWith(BEARER_PREFIX)) {
      throw new CommandRefused(GrpcStatus.UNAUTHENTICATED, 'A service token is required');
    }
    try {
      return await this.verifier.verify(header.slice(BEARER_PREFIX.length));
    } catch {
      throw new CommandRefused(GrpcStatus.UNAUTHENTICATED, 'The service token is not valid');
    }
  }

  private toServiceError(error: unknown, requestId: string) {
    const metadata = new Metadata();
    metadata.set(REQUEST_ID_METADATA, requestId);
    if (error instanceof CommandRefused) {
      return { code: error.status, details: error.message, metadata };
    }
    const resolved = resolveError(error);
    if (resolved.status >= 500) {
      this.logger.error(error instanceof Error ? error : String(error));
    }
    metadata.set(ERROR_CODE_METADATA, resolved.code);
    if (resolved.details !== undefined) {
      const details = JSON.stringify(resolved.details);
      if (details.length <= MAX_ERROR_DETAILS_LENGTH) {
        metadata.set(ERROR_DETAILS_METADATA, details);
      }
    }
    return { code: grpcStatusFor(resolved.status), details: resolved.message, metadata };
  }
}
