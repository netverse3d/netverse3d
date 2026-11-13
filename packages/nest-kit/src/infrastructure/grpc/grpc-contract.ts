import {
  GrpcObject,
  loadPackageDefinition,
  ServiceClientConstructor,
  ServiceDefinition,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';

const CONTRACT_NAME = /^[a-z][a-z0-9-]*$/;

export type GrpcContract = GrpcObject;

export function loadContractFile(file: string): GrpcContract {
  return loadPackageDefinition(
    loadSync(file, { keepCase: false, longs: String, enums: String, defaults: true, oneofs: true }),
  );
}

export function loadContract(name: string): GrpcContract {
  if (!CONTRACT_NAME.test(name)) {
    throw new Error(`Cannot look up a gRPC contract named "${name}"`);
  }
  return loadContractFile(require.resolve(`@netverse/contracts/grpc/v1/${name}.proto`));
}

export function serviceClientOf(contract: GrpcContract, path: string): ServiceClientConstructor {
  const found = path
    .split('.')
    .reduce<unknown>(
      (scope, part) => (scope as Record<string, unknown> | undefined)?.[part],
      contract,
    );
  if (typeof found !== 'function' || !('service' in found)) {
    throw new Error(`The gRPC contract does not define service ${path}`);
  }
  return found as ServiceClientConstructor;
}

export function serviceDefinitionOf(contract: GrpcContract, path: string): ServiceDefinition {
  return serviceClientOf(contract, path).service;
}
