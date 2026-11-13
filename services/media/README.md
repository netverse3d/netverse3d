# media

Service: Asset 3D, ảnh, âm thanh, metadata, object storage chuẩn S3, CDN.

- Stack: NestJS, Prisma, PostgreSQL, object storage chuẩn S3
- Milestone: M2
- Trạng thái: có mã, có image, chạy trên `packages/nest-kit`, chạy được trong `infra/compose`; xem [kịch bản chạy thử](../../docs/runbooks/stack-smoke.md)
- Nguồn gốc mã: [ADR-0023](../../docs/decisions/ADR-0023-media-service-origin-and-object-storage.md)

Service quản lý vòng đời tệp trên object storage: cấp URL ký sẵn để client tải thẳng lên kho, xác minh tệp, phân quyền, kiểm duyệt, lưu tạm, lưu giữ và dọn dẹp. Service không chuyển tiếp nội dung tệp.

## Luồng chính

1. `POST /v1/media/issue-upload-url` tạo bản ghi `PENDING`, trả `uploadUrl` và `requiredHeaders`.
2. Client `PUT` tệp thẳng lên `uploadUrl`, gửi đúng `requiredHeaders`.
3. `POST /v1/media/:id/complete` kiểm tra tệp thật trong kho, đối chiếu dung lượng và định dạng, chuyển `ACTIVE`.
4. `POST /v1/media/:id/issue-download-url` cấp URL tải xuống có thời hạn.

Tệp nháp dùng `temporary: true`, tự hết hạn theo `ttlHours`; muốn giữ lại thì gọi `POST /v1/media/:id/promote`.

## Khái niệm

| Khái niệm    | Giá trị        | Ý nghĩa                                                            |
| ------------ | -------------- | ------------------------------------------------------------------ |
| `mediaClass` | `USER_CONTENT` | Người dùng tải lên, theo chính sách chặt, có thể phải kiểm duyệt   |
|              | `SYSTEM_ASSET` | Tài nguyên hệ thống như mô hình 3D, chỉ quản trị nền tảng được tạo |
| `visibility` | `PRIVATE`      | Chỉ người tạo và quản trị của tiệm                                 |
|              | `INTERNAL`     | Mọi thành viên trong tenant của tiệm                               |
|              | `PUBLIC`       | Mọi tài khoản đã đăng nhập, lưu ở bucket riêng                     |
| `lifecycle`  | `TEMPORARY`    | Tự xoá lúc hết hạn                                                 |
|              | `PERMANENT`    | Giữ lâu dài, bắt buộc có `ownerType`, `ownerId`                    |

Không có quyền thì trả `404`, không để lộ việc tệp có tồn tại. Quyền theo [ADR-0025](../../docs/decisions/ADR-0025-media-access-by-tenant-model.md):

- Token gắn tenant của một tiệm chỉ chạm được tệp của tiệm đó. Vai trò `admin` của tiệm quản lý mọi tệp trong tiệm.
- Token không gắn tenant là của người chơi: chỉ thấy tệp do mình tạo, và tải lên với `ownerId` là chính tài khoản đó.
- Tệp `PUBLIC` thì mọi tài khoản đã đăng nhập đọc và tải được, dù thuộc tiệm nào, theo [ADR-0026](../../docs/decisions/ADR-0026-public-shop-media-and-tenant-creation.md). Người ngoài tiệm không liệt kê, không đổi, không xoá được.
- Quản trị nền tảng, tức token không gắn tenant mang `platform_admin`, thấy mọi tệp, duyệt nội dung và tạo asset hệ thống. Quản trị của tiệm không duyệt được nội dung của tiệm mình.

Ở production service từ chối khởi động nếu `S3_SECRET_KEY` hoặc mật khẩu trong `DATABASE_URL` là giá trị mẫu.

URL ký sẵn được ký theo địa chỉ kho mà client gọi tới. Lúc địa chỉ đó khác địa chỉ service dùng nội bộ, khai `S3_PUBLIC_ENDPOINT`, `S3_PUBLIC_PORT`, `S3_PUBLIC_USE_SSL`; `infra/compose` khai sẵn để trình duyệt trên máy dev dùng được URL.

Định dạng và dung lượng cho từng lớp cấu hình qua `MEDIA_SYSTEM_ASSET_*`, `MEDIA_USER_CONTENT_*`. Đặt `MEDIA_USER_CONTENT_REQUIRES_REVIEW=true` để nội dung người dùng phải được `POST /v1/media/:id/moderation` duyệt trước lúc người khác tải được.

## Xác thực

Service kiểm JWT bằng JWKS lấy từ `AUTH_JWKS_URL`, đối chiếu `AUTH_ISSUER` và `AUTH_AUDIENCE`. Trong `infra/compose` các giá trị này trỏ về `services/identity`. Lúc chỉ chạy riêng media, dùng bộ phát token mẫu: `pnpm --filter @netverse/media dev:issuer`.

## Sự kiện

Mỗi thay đổi ghi vào bảng `outbox_events` cùng giao dịch: `media.completed`, `media.promoted`, `media.deleted`, `media.moderated`. Job chuyển sự kiện qua cổng `EventPublisher`; hiện chỉ có adapter ghi log. Khai `KAFKA_BROKERS` thì sự kiện lên topic `netverse.media.events.v1`, để trống thì chỉ ghi log.

Sự kiện gửi ra theo vỏ chung `packages/contracts/events/v1/envelope.schema.json`, với `source` là tên service. Phần `data` theo `packages/contracts/events/v1/media.schema.json` và luôn có `mediaId`, `tenantId`.

## Hợp đồng HTTP

`openapi.yaml` được sinh từ mã, theo OpenAPI 3.1. Bản công bố cho service khác nằm ở `packages/contracts/openapi/v1/media.yaml` và phải trùng với bản sinh ra; unit test của service kiểm điều này. Sau lúc đổi API:

```
pnpm --filter @netverse/media openapi:export
pnpm format
cp services/media/openapi.yaml packages/contracts/openapi/v1/media.yaml
```

Bộ kiểm hợp đồng chặn thay đổi phá vỡ trên bản công bố; lúc đó phải mở phiên bản mới theo README của `packages/contracts`.

## Health

`/livez` báo tiến trình còn sống. `/healthz` báo cơ sở dữ liệu và object storage đã sẵn sàng.

## Kiểm tra

```
pnpm --filter @netverse/media lint
pnpm --filter @netverse/media test
pnpm --filter @netverse/media build
```

Test đầu cuối cần PostgreSQL đã chạy migration và dùng kho giả trong bộ nhớ:

```
DATABASE_URL=postgresql://... pnpm --filter @netverse/media test:e2e
```

Cấu hình đọc từ biến môi trường, xem `.env.example`. Trước lúc sửa, đọc [chuẩn thành phần](../../docs/wiki/engineering/component-standard.md).
