# ADR-0023: Nguồn gốc mã của media service và object storage ở môi trường dev

- Trạng thái: accepted
- Ngày: 2026-11-12
- Xem thêm: [ADR-0005](./ADR-0005-public-repository.md), [ADR-0008](./ADR-0008-media-replaces-asset.md), [ADR-0020](./ADR-0020-monorepo-layout-and-index.md)

## Bối cảnh

`services/media` đang chỉ giữ chỗ. Người dẫn dắt nhóm đã có sẵn một media service viết bằng NestJS ở repo riêng không công khai, do chính người đó viết và giữ bản quyền. Repo này công khai, và [ADR-0005](./ADR-0005-public-repository.md) cùng [chuẩn thành phần](../wiki/engineering/component-standard.md) yêu cầu mọi mã có nguồn ngoài repo phải có phép rõ ràng, ghi thành ADR, trước lúc vào repo.

Service cần object storage chuẩn S3. Sơ đồ của mentor ghi MinIO, nhưng bản cộng đồng của MinIO đã ngừng phát triển: không còn image chính thức từ cuối năm 2025 và kho mã đã bị lưu trữ, chỉ còn đọc, từ tháng 4 năm 2026. Bản backend mẫu của mentor dùng RustFS. Service sắp nhập đã chạy thử với SeaweedFS.

## Quyết định

### Nguồn gốc mã

1. Mã của `services/media` được nhập từ repo riêng của người dẫn dắt nhóm, tài khoản GitHub `baodhg`, tại một bản chụp cố định. Lịch sử git của repo riêng không được mang theo.
2. Người cho phép là chủ sở hữu mã, cũng là người dẫn dắt nhóm. Phép được xác nhận ngày 2026-11-12 trong lúc lập kế hoạch nhập, với nội dung: mã do người đó viết, thuộc quyền của người đó, và được phép công khai trong repo này.
3. Phạm vi của phép là repo này, theo giấy phép của repo. Phép không mở rộng sang việc dùng lại mã ở nơi khác.
4. `services/media/component.yaml` ghi `provenance: cleared` và trỏ về ADR này.
5. Trước lúc nhập, bản chụp được quét secret, và phải không còn tên miền, tenant, dữ liệu mẫu hay cấu hình của hệ thống khác, theo [quy trình nhận service](../runbooks/import-service.md).
6. Sau lúc nhập, monorepo là bản gốc của service theo [ADR-0020](./ADR-0020-monorepo-layout-and-index.md); repo riêng không nhận thêm thay đổi.

### Object storage

7. Môi trường dev dùng SeaweedFS làm object storage chuẩn S3 trong `infra/compose`.
8. Service chỉ dùng giao thức S3 và nhận địa chỉ, khoá, tên bucket qua biến môi trường. Đổi sản phẩm object storage không phải sửa mã service.
9. Lựa chọn cho production chưa chốt và sẽ quyết cùng lúc với hạ tầng triển khai theo REQ-026.

## Hệ quả

- REQ-006 và REQ-007 được chấp nhận, vì service nhập vào phủ cả hai: lớp asset của hệ thống và lớp nội dung người dùng có kiểm duyệt.
- Câu hỏi mở về object storage được đóng cho môi trường dev.
- Mã đã công khai thì không thu hồi được, nên bước quét secret và đọc lại thay đổi trước lúc đẩy là bắt buộc.
- Phần mã khung của service (response, lỗi, phân trang, xác thực, log) tạm nằm trong `services/media`. Nó được rút về `packages/nest-kit` lúc service NestJS thứ hai vào repo.
- `identity` chưa có trong repo, nên ở dev service kiểm token bằng một bộ phát token mẫu. Lúc `identity` vào thì trỏ sang nó bằng biến môi trường.
