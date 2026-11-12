import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiResponseDto } from '../dto/api-response.dto';
import { PageResponseDto } from '../pagination/page-response.dto';

export function ApiEnvelope<Model extends Type<unknown>>(
  model: Model,
  status: number = HttpStatus.OK,
) {
  return applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    ApiResponse({
      status,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          { properties: { result: { $ref: getSchemaPath(model) } } },
        ],
      },
    }),
  );
}

export function ApiPagedEnvelope<Model extends Type<unknown>>(model: Model) {
  return applyDecorators(
    ApiExtraModels(ApiResponseDto, PageResponseDto, model),
    ApiResponse({
      status: HttpStatus.OK,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            properties: {
              result: {
                allOf: [
                  { $ref: getSchemaPath(PageResponseDto) },
                  {
                    properties: {
                      content: { type: 'array', items: { $ref: getSchemaPath(model) } },
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    }),
  );
}
