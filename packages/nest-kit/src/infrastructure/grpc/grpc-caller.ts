import { Client, credentials, Metadata, ServiceError, status as GrpcStatus } from '@grpc/grpc-js';
import { GrpcContract, serviceClientOf } from './grpc-contract';
import {
  AUTHORIZATION_METADATA,
  ERROR_CODE_METADATA,
  IDEMPOTENCY_KEY_METADATA,
  REQUEST_ID_METADATA,
} from './grpc-server';

export interface CommandCallOptions {
  token: string;
  idempotencyKey: string;
  timeoutMs: number;
  requestId?: string;
}

export class GrpcCallError extends Error {
  constructor(
    readonly status: GrpcStatus,
    message: string,
    readonly errorCode: string | null,
  ) {
    super(message);
  }
}

type UnaryMethod = (
  request: object,
  metadata: Metadata,
  options: { deadline: number },
  callback: (error: ServiceError | null, reply: unknown) => void,
) => void;

export interface CommandClient {
  call<Reply>(method: string, request: object, options: CommandCallOptions): Promise<Reply>;
  close(): void;
}

function methodNameOf(command: string): string {
  return command.charAt(0).toLowerCase() + command.slice(1);
}

function toCallError(error: ServiceError): GrpcCallError {
  const [errorCode] = error.metadata?.get(ERROR_CODE_METADATA) ?? [];
  return new GrpcCallError(
    error.code,
    error.details || error.message,
    typeof errorCode === 'string' ? errorCode : null,
  );
}

export function connectCommands(
  contract: GrpcContract,
  servicePath: string,
  address: string,
): CommandClient {
  const ServiceClient = serviceClientOf(contract, servicePath);
  const client: Client = new ServiceClient(address, credentials.createInsecure());
  return {
    call<Reply>(method: string, request: object, options: CommandCallOptions): Promise<Reply> {
      if (!(options.timeoutMs > 0)) {
        return Promise.reject(new Error('timeoutMs must be a positive number of milliseconds'));
      }
      const invoke = (client as unknown as Record<string, UnaryMethod | undefined>)[
        methodNameOf(method)
      ];
      if (!invoke) {
        return Promise.reject(new Error(`${servicePath} has no command ${method}`));
      }
      const metadata = new Metadata();
      if (options.token) {
        metadata.set(AUTHORIZATION_METADATA, `Bearer ${options.token}`);
      }
      if (options.idempotencyKey) {
        metadata.set(IDEMPOTENCY_KEY_METADATA, options.idempotencyKey);
      }
      if (options.requestId) {
        metadata.set(REQUEST_ID_METADATA, options.requestId);
      }
      return new Promise<Reply>((resolve, reject) => {
        invoke.call(
          client,
          request,
          metadata,
          { deadline: Date.now() + options.timeoutMs },
          (error, reply) => (error ? reject(toCallError(error)) : resolve(reply as Reply)),
        );
      });
    },
    close(): void {
      client.close();
    },
  };
}
