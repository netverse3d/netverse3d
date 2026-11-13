# notification

Service: Thông báo qua email, push và hộp thư trong ứng dụng.

- Stack: NestJS, Prisma, PostgreSQL
- Milestone: M3
- Trạng thái: có mã, có image, chạy trên `packages/nest-kit`, chạy được trong `infra/compose`; xem [kịch bản chạy thử](../../docs/runbooks/stack-smoke.md)
- Nguồn gốc mã và phạm vi kênh: [ADR-0027](../../docs/decisions/ADR-0027-notification-service-origin-and-channels.md)

Service nhận yêu cầu gửi thông báo, tách thành từng lần gửi theo kênh, render template của tiệm rồi gửi qua nhà cung cấp. Nó không biết gì về nghiệp vụ của bên gọi.

## Luồng chính

1. Bên gọi `POST /v1/notifications`, tenant lấy từ token.
2. Mỗi kênh và mỗi địa chỉ thành một dòng trong `notification_deliveries`, trạng thái `PENDING`.
3. Job nhận dòng đến hạn bằng `FOR UPDATE SKIP LOCKED`, kiểm chặn và opt-out, render template, gửi.
4. Kết quả cuối cùng ghi vào `outbox_events` cùng giao dịch.

Gửi `idempotency-key` để gửi lại an toàn. Khoá theo tenant, dùng lại với nội dung khác trả `422`.

Nếu không truyền `channels`, service chọn các kênh vừa có địa chỉ người nhận vừa có template. Không kênh nào thoả thì dùng mọi kênh có địa chỉ, và các lần gửi đó vào `DEAD` với lý do rõ ràng.

## Trạng thái gửi

| Trạng thái   | Ý nghĩa                                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PENDING`    | Chờ gửi hoặc chờ thử lại theo `nextAttemptAt`                                                                                                                               |
| `PROCESSING` | Một worker đang giữ, hết hạn giữ chỗ thì được nhận lại                                                                                                                      |
| `SENT`       | Đã gửi                                                                                                                                                                      |
| `SKIPPED`    | Bỏ qua: `OPTED_OUT`, `ADDRESS_BLOCKED`                                                                                                                                      |
| `DEAD`       | Không gửi được: `TEMPLATE_NOT_FOUND`, `TEMPLATE_INVALID`, `MISSING_VARIABLE`, `RECIPIENT_ADDRESS_MISSING`, `CHANNEL_DISABLED`, `PROVIDER_REJECTED`, `MAX_ATTEMPTS_EXCEEDED` |

Lỗi tạm thời của nhà cung cấp được thử lại theo cấp số nhân tới `DELIVERY_MAX_ATTEMPTS`. Service đảm bảo gửi ít nhất một lần: tiến trình chết đúng lúc giữa việc gửi và ghi kết quả thì tin có thể được gửi hai lần.

## Template

Khoá là `eventType + channel + locale`, cú pháp Handlebars. Thiếu template đúng ngôn ngữ thì dùng `DEFAULT_LOCALE`. Mỗi lần sửa tăng `version`.

Lúc lưu, service từ chối template sai cú pháp, partial, decorator, helper ngoài `if`, `unless`, `each`, `with`, `lookup`, và xuất thô `{{{x}}}` trong thân email.

Lúc render, biến thiếu hoặc `null` làm lần gửi vào `DEAD`, không gửi nội dung trống. Thân email được thoát HTML. Tiêu đề, push và hộp thư là văn bản thuần, không thoát; ứng dụng hiển thị phải coi chúng là văn bản.

Thương hiệu quản lý ở `/v1/branding/:key`, dùng trong template qua `{{brand.key}}`. Biến của bên gọi không ghi đè được `brand`. Service không kèm sẵn template nào.

## Quyền

| Route                                                                      | Ai gọi được                                     |
| -------------------------------------------------------------------------- | ----------------------------------------------- |
| `POST /v1/notifications`                                                   | Vai trò `notification:send`, hoặc quản trị tiệm |
| `/v1/templates`, `/v1/branding`, `/v1/blocked-addresses`, `/v1/deliveries` | Quản trị tiệm                                   |
| `/v1/inbox`, `/v1/preferences/opt-outs`                                    | Người đã đăng nhập, chỉ dữ liệu của chính mình  |

Mọi dữ liệu giới hạn trong tenant lấy từ token. Token không gắn tenant bị từ chối bằng `NOTIFICATION.TENANT_REQUIRED`, nên hiện người chơi chưa có hộp thư và quản trị nền tảng chưa quản lý được template của tiệm; xem ADR-0027. Không có quyền với một tài nguyên thì trả `404`.

## Kênh gửi

Mỗi kênh là một adapter của cổng `ChannelSender`.

| Biến             | Giá trị                   | Ý nghĩa                       |
| ---------------- | ------------------------- | ----------------------------- |
| `EMAIL_PROVIDER` | `brevo`, `log`, `none`    | `log` bị từ chối ở production |
| `PUSH_PROVIDER`  | `firebase`, `log`, `none` | `log` bị từ chối ở production |

`none` tắt kênh, lần gửi vào `DEAD` với `CHANNEL_DISABLED`. `IN_APP` luôn bật và lưu vào `inbox_items`.

## Sự kiện

Service ghi vào `outbox_events`: `notification.delivery.sent`, `notification.delivery.skipped`, `notification.delivery.dead`. Sự kiện gửi ra theo vỏ chung của hệ thống, phần `data` theo `packages/contracts/events/v1/notification.schema.json` và không chứa địa chỉ người nhận. Hiện chỉ có adapter ghi log.

Cổng nghe sự kiện vào `EventConsumer` được giữ lại nhưng đang tắt. Nghe sự kiện qua Kafka thuộc đợt chuẩn hoá sau, theo ADR-0027.

## Cấu hình tuỳ chọn

Các biến này không có trong `.env.example`, chỉ khai lúc dùng tới:

| Biến                                                                   | Dùng cho              |
| ---------------------------------------------------------------------- | --------------------- |
| `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`               | Gửi email qua Brevo   |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Gửi push qua Firebase |

Một lô gửi phải xong trong `DELIVERY_LEASE_MS` và 240 giây. Cấu hình `DELIVERY_BATCH_SIZE`, `DELIVERY_CONCURRENCY`, `PROVIDER_TIMEOUT_MS` vượt mức này thì service không khởi động. Ở production service cũng từ chối khởi động nếu khoá của nhà cung cấp hoặc mật khẩu trong `DATABASE_URL` là giá trị mẫu.

## Hợp đồng HTTP

`openapi.yaml` được sinh từ mã, theo OpenAPI 3.1. Bản công bố nằm ở `packages/contracts/openapi/v1/notification.yaml` và phải trùng với bản sinh ra. Sau lúc đổi API:

```
pnpm --filter @netverse/notification openapi:export
pnpm format
cp services/notification/openapi.yaml packages/contracts/openapi/v1/notification.yaml
```

## Kiểm tra

```
pnpm --filter @netverse/notification lint
pnpm --filter @netverse/notification test
pnpm --filter @netverse/notification build
```

Test đầu cuối cần PostgreSQL trống; script tự áp migration:

```
DATABASE_URL=postgresql://... pnpm --filter @netverse/notification test:e2e
```

Unit test nằm ở `test/unit`. Prisma client của service được sinh vào `generated/` và không commit. Cấu hình đọc từ biến môi trường, xem `.env.example`. Trước lúc sửa, đọc [chuẩn thành phần](../../docs/wiki/engineering/component-standard.md).
