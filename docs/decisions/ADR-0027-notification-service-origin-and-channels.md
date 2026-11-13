# ADR-0027: Nguồn gốc mã của notification service và ba kênh thông báo

- Trạng thái: accepted
- Ngày: 2026-11-13
- Xem thêm: [ADR-0005](./ADR-0005-public-repository.md), [ADR-0020](./ADR-0020-monorepo-layout-and-index.md), [ADR-0024](./ADR-0024-identity-origin-and-shop-tenants.md), [ADR-0025](./ADR-0025-media-access-by-tenant-model.md)

## Bối cảnh

`services/notification` đang chỉ giữ chỗ. Người dẫn dắt nhóm đã có sẵn một notification service viết bằng NestJS ở repo riêng không công khai, do chính người đó viết và giữ bản quyền. Như với media và identity, repo này công khai nên quyền dùng mã phải được ghi thành quyết định trước lúc mã vào.

Service đó gửi thông báo qua ba kênh: email, push và hộp thư trong ứng dụng. Nó nhận yêu cầu gửi qua HTTP, và có một đường nghe sự kiện qua RabbitMQ. Kiến trúc của hệ thống ghi sự kiện giữa các service đi qua Kafka và lời gọi đồng bộ giữa các service đi qua gRPC, nên đường RabbitMQ không khớp.

[REQ-008](../requirements/registry.yaml) về thông báo đang ở trạng thái nháp và chưa nói rõ kênh nào.

## Quyết định

### Nguồn gốc mã

1. Mã của `services/notification` được nhập từ repo riêng của người dẫn dắt nhóm, tài khoản GitHub `baodhg`, tại một bản chụp cố định. Lịch sử git của repo riêng không được mang theo.
2. Người cho phép là chủ sở hữu mã, cũng là người dẫn dắt nhóm. Phép được xác nhận ngày 2026-11-13 với nội dung: mã do người đó viết, thuộc quyền của người đó, và được phép công khai trong repo này. Phạm vi của phép là repo này.
3. `services/notification/component.yaml` ghi `provenance: cleared` và trỏ về ADR này. Bản chụp được quét secret trước lúc nhập.
4. Phần mã nền trùng với media và identity không được nhập lại; notification dùng `packages/nest-kit`.

### Kênh thông báo

5. REQ-008 được chốt với ba kênh: email, hộp thư trong ứng dụng và push.
6. Vai trò theo [ADR-0025](./ADR-0025-media-access-by-tenant-model.md): quản lý template, thương hiệu và danh sách chặn của một tiệm là việc của quản trị tiệm đó; quản trị nền tảng làm được với mọi tiệm.

### Thứ tự làm

7. Đợt này nhập service và cho nó chạy trên `packages/nest-kit`, nhận yêu cầu gửi qua HTTP. Bộ nghe RabbitMQ không được nhập; cổng nghe sự kiện được giữ lại, ở trạng thái tắt.
8. Đợt kế tiếp chuẩn hoá một lần cho mọi service: sự kiện thật lên Kafka, lời gọi giữa các service qua gRPC kèm định danh riêng của service, và cách cắm nhiều nhà cung cấp email gồm SMTP, Resend và Gmail API bên cạnh Brevo đã có.

## Hệ quả

- Sau đợt này notification chạy được và có test, nhưng chưa service nào gọi nó: identity vẫn gửi mã xác minh email qua webhook cho tới đợt chuẩn hoá.
- Push cần tài khoản Firebase mới gửi thật được. Ở dev kênh push và kênh email ghi ra log.
- Ở production service từ chối khởi động nếu kênh email hoặc push đặt ở chế độ ghi log.
- Mã đã công khai thì không thu hồi được, nên bước quét secret và đọc lại thay đổi trước lúc đẩy là bắt buộc.
