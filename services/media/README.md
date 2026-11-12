# media

Service: Asset 3D, ảnh, âm thanh, metadata, object storage chuẩn S3, CDN.

- Stack: NestJS, Prisma, PostgreSQL, object storage chuẩn S3
- Milestone: M2
- Trạng thái: có mã, có image, chạy trên `packages/nest-kit`, chạy được trong `infra/compose`; xem [kịch bản chạy thử](../../docs/runbooks/media-smoke.md)
- Nguồn gốc mã: [ADR-0023](../../docs/decisions/ADR-0023-media-service-origin-and-object-storage.md)

Service quản lý vòng đời tệp trên object storage: cấp URL ký sẵn để client tải thẳng lên kho, xác minh tệp, phân quyền, kiểm duyệt, lưu tạm, lưu giữ và dọn dẹp. Service không chuyển tiếp nội dung tệp.

## Luồng chính

1. `POST /v1/media/issue-upload-url` tạo bản ghi `PENDING`, trả `uploadUrl` và `requiredHeaders`.
2. Client `PUT` tệp thẳng lên `uploadUrl`, gửi đúng `requiredHeaders`.
3. `POST /v1/media/:id/complete` kiểm tra tệp thật trong kho, đối chiếu dung lượng và định dạng, chuyển `ACTIVE`.
4. `POST /v1/media/:id/issue-download-url` cấp URL tải xuống có thời hạn.

Tệp nháp dùng `temporary: true`, tự hết hạn theo `ttlHours`; muốn giữ lại thì gọi `POST /v1/media/:id/promote`.

## Khái niệm

| Khái niệm    | Giá trị              | Ý nghĩa                                                          |
| ------------ | -------------------- | ---------------------------------------------------------------- |
| `mediaClass` | `USER_CONTENT`       | Người dùng tải lên, theo chính sách chặt, có thể phải kiểm duyệt |
|              | `SYSTEM_ASSET`       | Tài nguyên hệ thống như mô hình 3D, chỉ vai trò `admin` được tạo |
| `visibility` | `PRIVATE`            | Chỉ người tạo và `admin` của tenant                              |
|              | `INTERNAL`, `PUBLIC` | Mọi người đã xác thực trong tenant, khác bucket lưu              |
| `lifecycle`  | `TEMPORARY`          | Tự xoá lúc hết hạn                                               |
|              | `PERMANENT`          | Giữ lâu dài, bắt buộc có `ownerType`, `ownerId`                  |

Mọi truy cập bị giới hạn trong tenant lấy từ token. Không có quyền thì trả `404`, không để lộ việc tệp có tồn tại.

Định dạng và dung lượng cho từng lớp cấu hình qua `MEDIA_SYSTEM_ASSET_*`, `MEDIA_USER_CONTENT_*`. Đặt `MEDIA_USER_CONTENT_REQUIRES_REVIEW=true` để nội dung người dùng phải được `POST /v1/media/:id/moderation` duyệt trước lúc người khác tải được.

## Xác thực

Service kiểm JWT bằng JWKS lấy từ `AUTH_JWKS_URL`, đối chiếu `AUTH_ISSUER` và `AUTH_AUDIENCE`. Lúc `identity` chưa có trong repo, ở dev dùng bộ phát token mẫu: `pnpm --filter @netverse/media dev:issuer`.

## Sự kiện

Mỗi thay đổi ghi vào bảng `outbox_events` cùng giao dịch: `media.completed`, `media.promoted`, `media.deleted`, `media.moderated`. Job chuyển sự kiện qua cổng `EventPublisher`; hiện chỉ có adapter ghi log.

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
