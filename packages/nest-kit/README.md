# nest-kit

Package dùng chung: Bộ khung dùng chung của các service NestJS, gồm response, lỗi, phân trang, xác thực, log.

- Stack: NestJS
- Milestone: M1
- Trạng thái: có mã; `services/media` đang chạy trên package này
- Nguồn gốc mã: [ADR-0023](../../docs/decisions/ADR-0023-media-service-origin-and-object-storage.md)

Package này chỉ phục vụ service viết bằng NestJS. Chuẩn chung cho mọi service, kể cả service viết bằng ngôn ngữ khác, nằm ở `packages/contracts`, theo [ADR-0020](../../docs/decisions/ADR-0020-monorepo-layout-and-index.md).

## Có gì

| Phần                        | Nội dung                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `common`                    | Ngữ cảnh request, decorator, response và lỗi chuẩn, filter, interceptor, phân trang, validation    |
| `infrastructure/auth`       | Kiểm JWT qua JWKS, guard xác thực và guard vai trò, phép kiểm quản trị nền tảng và quản trị tenant |
| `infrastructure/logger`     | Log có cấu trúc, che trường nhạy cảm                                                               |
| `infrastructure/rate-limit` | Giới hạn tần suất                                                                                  |
| `infrastructure/jobs`       | Job chạy định kỳ có khoá, để nhiều bản sao không chạy trùng                                        |
| `modules/audit`             | Ghi và đọc audit log                                                                               |
| `modules/outbox`            | Outbox, job chuyển sự kiện, vỏ sự kiện chung                                                       |
| `modules/health`            | `/livez` và `/healthz`                                                                             |
| `config`                    | Đọc biến môi trường theo schema, nhận ra giá trị mẫu để từ chối ở production                       |
| `bootstrap`                 | Cấu hình ứng dụng HTTP và tài liệu OpenAPI                                                         |

## Service nối vào thế nào

Package không biết cấu hình hay cơ sở dữ liệu của service. Service cấp hai thứ qua tiêm phụ thuộc:

| Cổng        | Service làm gì                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------- |
| `KitConfig` | Lớp cấu hình của service kế thừa `KitConfig` và khai `{ provide: KitConfig, useExisting: ... }` |
| `Database`  | Khai `{ provide: Database, useExisting: PrismaService }`                                        |

Schema Prisma của service phải có hai model `AuditLog` và `OutboxEvent` với các trường như ở `services/media/prisma/schema.prisma`.

`HealthModule` kiểm cơ sở dữ liệu sẵn. Service có thêm phụ thuộc bắt buộc thì khai bằng `HealthModule.withProbes(...)`, như `services/media/src/app.module.ts`.

## Kiểm tra

```
pnpm --filter @netverse/nest-kit lint
pnpm --filter @netverse/nest-kit test
pnpm --filter @netverse/nest-kit build
```

Unit test nằm ở `test/unit`, theo đúng cây thư mục của `src`. Service dùng bản đã build trong `dist`, nên sửa package xong phải build lại trước lúc chạy test của service; `pnpm verify` tự làm việc này.

Trước lúc sửa, đọc [chuẩn thành phần](../../docs/wiki/engineering/component-standard.md).
