# identity

Service: Đăng ký, đăng nhập, JWT, RBAC.

- Stack: NestJS, Prisma, PostgreSQL
- Milestone: M1
- Trạng thái: có mã, có image, chạy trên `packages/nest-kit`, chạy được trong `infra/compose`; xem [kịch bản chạy thử](../../docs/runbooks/stack-smoke.md)
- Nguồn gốc mã và mô hình vai trò: [ADR-0024](../../docs/decisions/ADR-0024-identity-origin-and-shop-tenants.md)

Service quản lý tài khoản, phiên đăng nhập, token, tenant và vai trò. Service khác không gọi sang đây để kiểm quyền; chúng xác minh token bằng khoá công khai lấy từ `/.well-known/jwks.json`.

## Mô hình

- **Principal**: một tài khoản, email là duy nhất toàn hệ thống.
- **Tenant**: không gian của một tiệm.
- **Membership**: nối tài khoản với tenant, kèm **Role** do từng tenant tự định và danh sách quyền.

Người chơi là mọi tài khoản đã đăng nhập, dùng token không gắn tenant. Chủ tiệm là thành viên tenant của tiệm mình. Quản trị là quyền nền tảng gắn trên tài khoản.

Tên vai trò `platform_admin` dành riêng cho nền tảng: tenant không tạo được vai trò trùng tên, và tên đó chỉ có trong token không gắn tenant. Ở production service từ chối khởi động nếu khoá hoặc mật khẩu quản trị là giá trị mẫu.

## Đăng nhập

| Cách              | Endpoint                         | Ghi chú                                                                    |
| ----------------- | -------------------------------- | -------------------------------------------------------------------------- |
| Email và mật khẩu | `POST /v1/auth/login`            | Phải xác minh email trước; tự khoá tạm lúc sai nhiều lần                   |
| Mạng xã hội       | `POST /v1/auth/social/:provider` | Mỗi nhà cung cấp chỉ bật lúc có cấu hình; `GET /v1/auth/providers` liệt kê |

Email từ nhà cung cấp chỉ được dùng để nối tài khoản lúc đã xác minh.

## Token

Access token ký RS256, có `sub`, `tenant_id` nếu đã chọn tenant, `roles`, `permissions`, `sid`, `ver`. `TOKEN_AUDIENCES` khai các audience được cấp. `POST /v1/auth/switch-tenant` đổi sang token gắn một tenant mà tài khoản là thành viên.

Refresh token xoay vòng mỗi lần dùng. Dùng lại token cũ sau thời gian ân hạn sẽ thu hồi cả phiên. Các route của chính service này kiểm thêm trạng thái phiên, nên đăng xuất có hiệu lực ngay; ở service khác token còn dùng được tới lúc hết hạn, mặc định 15 phút.

Khoá ký được mã hoá trong cơ sở dữ liệu bằng `KEY_ENCRYPTION_SECRET`, một chuỗi 64 ký tự hex. Mất khoá này thì mọi khoá ký không dùng được nữa. Quản trị nền tảng xoay khoá bằng `POST /v1/keys/rotate`; khoá cũ còn xác minh được trong thời gian chuyển.

## Tài khoản của service

Một service gọi service khác bằng token của chính nó, theo [ADR-0028](../../docs/decisions/ADR-0028-service-to-service-communication.md).

- Quản trị nền tảng tạo tài khoản ở `POST /v1/admin/service-clients`, khai tên, các audience được phép và các quyền. Khoá bí mật chỉ hiện một lần trong câu trả lời và được lưu ở dạng băm.
- Service đổi mã và khoá bí mật lấy token ở `POST /v1/auth/service-token`, nêu một audience. Token sống `SERVICE_TOKEN_TTL_SECONDS` giây, mặc định 300, không có refresh token, không gắn tenant, không mang vai trò.
- `POST /v1/admin/service-clients/:id/rotate-secret` đổi khoá, khoá cũ hết dùng ngay. `POST /v1/admin/service-clients/:id/revoke` thu hồi tài khoản vĩnh viễn. Token đã cấp còn dùng được tới lúc hết hạn.
- Audience chỉ nhận các tên có trong `TOKEN_AUDIENCES`.

Token của service chỉ vào được route khai quyền bằng `@Permissions`; mọi route khác từ chối nó.

## Mã một lần

Mã xác minh email và đặt lại mật khẩu gửi qua cổng `OtpSender`. `OTP_DELIVERY=log` ghi mã ra log và chỉ dùng lúc phát triển; ở production service từ chối khởi động với giá trị này. `OTP_DELIVERY=webhook` gửi mã tới `OTP_WEBHOOK_URL` kèm chữ ký HMAC.

## Cấu hình tuỳ chọn

Các biến này không có trong `.env.example`, chỉ khai lúc dùng tới:

| Biến                                                | Dùng cho                       |
| --------------------------------------------------- | ------------------------------ |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`            | Đăng nhập Facebook             |
| `ZALO_APP_SECRET`                                   | Đăng nhập Zalo                 |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`          | Đăng nhập GitHub               |
| `OTP_WEBHOOK_URL`, `OTP_WEBHOOK_SECRET`             | Gửi mã một lần qua webhook     |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | Tạo quản trị nền tảng đầu tiên |

## Sự kiện

Ghi vào `outbox_events` cùng giao dịch: `user.registered`, `user.email-verified`, `user.deactivated`, `user.reactivated`, `membership.added`, `membership.revoked`, `role.changed`. Sự kiện gửi ra theo vỏ chung của hệ thống, phần `data` theo `packages/contracts/events/v1/identity.schema.json`; khai `KAFKA_BROKERS` thì sự kiện lên topic `netverse.identity.events.v1`, để trống thì chỉ ghi log.

## Hợp đồng HTTP

`openapi.yaml` được sinh từ mã, theo OpenAPI 3.1. Bản công bố nằm ở `packages/contracts/openapi/v1/identity.yaml` và phải trùng với bản sinh ra. Sau lúc đổi API:

```
pnpm --filter @netverse/identity openapi:export
pnpm format
cp services/identity/openapi.yaml packages/contracts/openapi/v1/identity.yaml
```

## Kiểm tra

```
pnpm --filter @netverse/identity lint
pnpm --filter @netverse/identity test
pnpm --filter @netverse/identity build
```

Test đầu cuối cần PostgreSQL trống; script tự áp migration:

```
DATABASE_URL=postgresql://... pnpm --filter @netverse/identity test:e2e
```

Unit test nằm ở `test/unit`. Prisma client của service được sinh vào `generated/` và không commit. Cấu hình đọc từ biến môi trường, xem `.env.example`. Trước lúc sửa, đọc [chuẩn thành phần](../../docs/wiki/engineering/component-standard.md).
