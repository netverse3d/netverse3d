# e2e

Kiểm đầu cuối trên cả hệ: dựng các service bằng `infra/compose`, đi qua cổng vào và chạy một luồng nghiệp vụ trọn vẹn, ví dụ đăng ký, mở tiệm, trả tiền, vào phòng.

- Chạy ở bước phát hành staging, không chạy ở mỗi PR.
- Mỗi thành phần chạy ở phiên bản staging hiện hành của nó, theo [ADR-0022](../../docs/decisions/ADR-0022-per-component-release-tags.md).
- Trạng thái: chỉ giữ chỗ, chưa có mã.
