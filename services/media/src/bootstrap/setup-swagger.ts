import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, getSchemaPath, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../common/dto/api-response.dto';
import { IS_PUBLIC_METADATA } from '../common/decorators/public.decorator';
import { AppConfig } from '../config/app-config';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const PROTECTED_ERROR_STATUSES = ['400', '401', '403', '429', '500'];
const PUBLIC_ERROR_STATUSES = ['400', '429', '500'];
const PUBLIC_EXTENSION = `x-${IS_PUBLIC_METADATA.replace(':', '-')}`;

function errorResponse() {
  return {
    description: 'Standard error envelope',
    content: { 'application/json': { schema: { $ref: getSchemaPath(ApiErrorResponseDto) } } },
  };
}

function withStandardErrorResponses(document: OpenAPIObject): OpenAPIObject {
  for (const pathItem of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as (typeof pathItem)['get'] & Record<string, unknown>;
      if (!operation) {
        continue;
      }
      const isPublic = operation[PUBLIC_EXTENSION] === true;
      delete operation[PUBLIC_EXTENSION];
      if (isPublic) {
        operation.security = [];
      }
      for (const status of isPublic ? PUBLIC_ERROR_STATUSES : PROTECTED_ERROR_STATUSES) {
        operation.responses[status] ??= errorResponse();
      }
    }
  }
  return document;
}

export function buildOpenApiDocument(app: INestApplication, config: AppConfig): OpenAPIObject {
  const options = new DocumentBuilder()
    .setTitle(config.service.name)
    .setVersion(config.service.version)
    .setOpenAPIVersion('3.1.0')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();
  return withStandardErrorResponses(
    SwaggerModule.createDocument(app, options, { extraModels: [ApiErrorResponseDto] }),
  );
}

export function setupSwagger(app: INestApplication, config: AppConfig): void {
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app, config), {
    jsonDocumentUrl: 'docs-json',
  });
}
