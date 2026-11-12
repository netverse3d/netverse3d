# gateway

Cổng vào duy nhất của hệ thống ở môi trường local và staging. Client chỉ thấy cổng này; các service nằm trong mạng nội bộ.

- Chuyển yêu cầu HTTP tới service theo tiền tố đường dẫn và chuyển kết nối WebSocket tới game server.
- Không chứa nghiệp vụ. Xác thực và phân quyền thuộc về từng service.
- Trạng thái: chỉ giữ chỗ, chưa có cấu hình. Cấu hình được thêm cùng lúc với service đầu tiên chạy trong `infra/compose`.

Xem sơ đồ ở [kiến trúc](../../docs/wiki/engineering/architecture.md).
