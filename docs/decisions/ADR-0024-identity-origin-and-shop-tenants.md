# ADR-0024: Nguồn gốc mã của identity service và mỗi tiệm là một tenant

- Trạng thái: accepted
- Ngày: 2026-11-12
- Xem thêm: [ADR-0005](./ADR-0005-public-repository.md), [ADR-0020](./ADR-0020-monorepo-layout-and-index.md), [ADR-0023](./ADR-0023-media-service-origin-and-object-storage.md)

## Bối cảnh

`services/identity` đang chỉ giữ chỗ. Người dẫn dắt nhóm đã có sẵn một identity service viết bằng NestJS ở repo riêng không công khai, do chính người đó viết và giữ bản quyền. Như với media ở [ADR-0023](./ADR-0023-media-service-origin-and-object-storage.md), repo này công khai nên quyền dùng mã phải được ghi thành quyết định trước lúc mã vào.

Service đó không gắn vai trò cố định vào tài khoản. Nó có ba khái niệm: tài khoản, tenant là một không gian không mang nghĩa nghiệp vụ, và tư cách thành viên của tài khoản trong tenant kèm vai trò do tenant tự định. Token được cấp theo tenant mà tài khoản đang chọn, hoặc không gắn tenant nào.

[REQ-002](../requirements/registry.yaml) cần ba vai trò: người chơi, chủ tiệm, quản trị, và một người có thể vừa là người chơi vừa là chủ tiệm. Cần quyết ba vai trò này ứng với gì trong mô hình tenant.

## Quyết định

### Nguồn gốc mã

1. Mã của `services/identity` được nhập từ repo riêng của người dẫn dắt nhóm, tài khoản GitHub `baodhg`, tại một bản chụp cố định. Lịch sử git của repo riêng không được mang theo.
2. Người cho phép là chủ sở hữu mã, cũng là người dẫn dắt nhóm. Phép được xác nhận ngày 2026-11-12 với nội dung: mã do người đó viết, thuộc quyền của người đó, và được phép công khai trong repo này. Phạm vi của phép là repo này.
3. `services/identity/component.yaml` ghi `provenance: cleared` và trỏ về ADR này. Bản chụp được quét secret trước lúc nhập.
4. Phần mã nền trùng với media không được nhập lại; identity dùng `packages/nest-kit`.

### Vai trò

5. Mỗi tiệm là một tenant.
6. Người chơi là mọi tài khoản đã đăng nhập. Người chơi dùng token không gắn tenant và không cần là thành viên của tiệm nào để vào tiệm đó.
7. Chủ tiệm là thành viên của tenant của tiệm mình, mang vai trò chủ tiệm trong tenant đó. Nhân viên của tiệm, nếu có về sau, là thành viên khác của cùng tenant với vai trò do tiệm định.
8. Một tài khoản vừa là người chơi vừa là chủ tiệm là trường hợp bình thường: cùng một tài khoản, lúc quản lý tiệm thì đổi sang token gắn tenant của tiệm.
9. Quản trị là quyền quản trị nền tảng gắn trên tài khoản, không thuộc tenant nào.
10. Service khác đọc vai trò từ token và không tự lưu vai trò. Thao tác trên dữ liệu của một tiệm đòi token gắn tenant của tiệm đó.
11. Với media: tệp của tiệm thuộc tenant của tiệm; tệp của người chơi và asset của hệ thống không gắn tenant.

## Hệ quả

- Token có hai dạng, gắn tenant và không gắn tenant, và client phải đổi token lúc chuyển giữa chơi và quản lý tiệm.
- Hiện chỉ quản trị nền tảng tạo được tenant. Lúc làm service `shop` phải quyết ai tạo tenant khi một tiệm được mở; việc này là câu hỏi mở.
- Đăng nhập bằng email và mật khẩu đòi xác minh email trước. Ở môi trường dev mã xác minh được ghi ra log; gửi thật qua `notification` làm sau.
- `identity` chưa có trong repo trước quyết định này, nên media dùng một bộ phát token mẫu ở dev. Sau lúc nhập, media trong `infra/compose` tin JWKS của identity.
- Mã đã công khai thì không thu hồi được, nên bước quét secret và đọc lại thay đổi trước lúc đẩy là bắt buộc.
