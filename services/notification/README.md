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

## Mệnh lệnh qua gRPC

Service khác gửi thông báo bằng lệnh `Send` của `netverse.notification.v1.NotificationCommands`, hợp đồng ở `packages/contracts/grpc/v1/notification.proto`. Khai `GRPC_PORT` thì máy chủ gRPC nghe ở cổng đó; không khai thì không mở.

- Bên gọi mang token của một tài khoản service có quyền `notification:send`. Token của người dùng bị từ chối.
- `scope` là mã tenant của tiệm mà lệnh làm thay. Lệnh thiếu `scope` bị từ chối; phạm vi nền tảng chưa được hỗ trợ.
- Metadata `idempotency-key` là bắt buộc, dài tối đa 128 ký tự. Khoá được tách theo từng tài khoản service, nên hai service dùng cùng một khoá không đụng nhau, và cũng không đụng khoá gửi qua HTTP.
- Nội dung được kiểm theo cùng luật với `POST /v1/notifications` rồi đi vào cùng đường xử lý.

Kiểu TypeScript của hợp đồng được sinh vào `src/generated/grpc` lúc cài đặt và trước mỗi lần `lint` hay `build`, không commit; sinh tay bằng `pnpm --filter @netverse/notification grpc:generate`. Đổi tệp `.proto` mà chưa sửa mã thì service không biên dịch được.

## Kênh gửi

Mỗi kênh là một adapter của cổng `ChannelSender`. `IN_APP` luôn bật và lưu vào `inbox_items`.

### Email

`EMAIL_PROVIDER` chọn nhà cung cấp. Nhà cung cấp thật nào cũng cần `EMAIL_FROM_ADDRESS`; `EMAIL_FROM_NAME` là tuỳ chọn.

| `EMAIL_PROVIDER` | Biến bắt buộc                                                   | Biến tuỳ chọn                               | Ghi chú                                             |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| `smtp`           | `SMTP_HOST`, `SMTP_PORT`                                        | `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | Mọi máy chủ SMTP; Gmail dùng mật khẩu ứng dụng      |
| `resend`         | `RESEND_API_KEY`                                                |                                             | Dùng mã lần gửi làm khoá chống trùng                |
| `gmail-api`      | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` |                                             | OAuth của Google Cloud, phạm vi `gmail.send`        |
| `brevo`          | `BREVO_API_KEY`                                                 |                                             |                                                     |
| `log`            |                                                                 |                                             | Ghi ra log, bị từ chối ở production                 |
| `none`           |                                                                 |                                             | Tắt kênh; lần gửi vào `DEAD` với `CHANNEL_DISABLED` |

Chỉ biến của nhà cung cấp đang chọn được kiểm. Thiếu biến bắt buộc thì service không khởi động và nêu tên biến. Ở production, khoá và mật khẩu của nhà cung cấp không được là giá trị mẫu.

Nhà cung cấp từ chối chính bức thư thì lần gửi vào `DEAD` với `PROVIDER_REJECTED`. Lỗi tạm thời, mất kết nối và khoá sai thì lần gửi được thử lại. Với SMTP, chỉ lời từ chối ở bước nhận người nhận hoặc nội dung mới tính là từ chối bức thư; sai mật khẩu hay người gửi không được nhận là lỗi cấu hình và được thử lại.

SMTP có khai `SMTP_USER` thì phải có `SMTP_PASSWORD`, và kết nối bắt buộc mã hoá: `SMTP_SECURE=true` hoặc máy chủ phải hỗ trợ STARTTLS.

### Thêm một nhà cung cấp email

1. Viết một tệp trong `src/modules/channels/adapters` gồm bộ gửi và một `EmailProvider`: tên, các biến môi trường của riêng nó, biến nào bắt buộc, biến nào là bí mật, và hàm tạo bộ gửi.
2. Thêm nó vào danh sách ở `src/modules/channels/email-providers.ts`.
3. Cho nó chạy qua bộ test chung `describeEmailSenderContract` trong `test/unit/modules/channels/adapters`.

Cấu hình, phép kiểm biến môi trường và phép chặn giá trị mẫu đọc từ danh sách đó, không cần sửa thêm chỗ nào.

### Push

| `PUSH_PROVIDER` | Ý nghĩa                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| `firebase`      | Cần `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| `log`           | Ghi ra log, bị từ chối ở production                                        |
| `none`          | Tắt kênh                                                                   |

## Sự kiện

Service ghi vào `outbox_events`: `notification.delivery.sent`, `notification.delivery.skipped`, `notification.delivery.dead`. Sự kiện gửi ra theo vỏ chung của hệ thống, phần `data` theo `packages/contracts/events/v1/notification.schema.json` và không chứa địa chỉ người nhận. Khai `KAFKA_BROKERS` thì sự kiện lên topic `netverse.notification.events.v1`, để trống thì chỉ ghi log.

Cổng nghe sự kiện vào `EventConsumer` nay nằm ở `packages/nest-kit`, cùng bộ nghe Kafka. Service chưa bật bộ nghe; việc phản ứng với sự kiện của service khác thuộc đợt chuẩn hoá notification, theo ADR-0028.

## Giới hạn của một lô gửi

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
