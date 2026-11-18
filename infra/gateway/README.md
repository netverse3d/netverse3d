# gateway

Cổng vào duy nhất của hệ thống ở môi trường local và staging. Client chỉ thấy cổng này; các service nằm trong mạng nội bộ.

- Chuyển yêu cầu HTTP tới service theo tiền tố đường dẫn và chuyển kết nối WebSocket tới game server.
- Không chứa nghiệp vụ. Xác thực và phân quyền thuộc về từng service.
- Nguồn route và chính sách là `routes.yaml`. Chạy `pnpm gateway:render` sau khi sửa và commit cả cấu hình được sinh cho Compose lẫn Kubernetes.

| Đường công khai              | Đích                                              |
| ---------------------------- | ------------------------------------------------- |
| `/api/identity/v1/…`         | identity; nhánh `/auth/…` có hạn mức riêng        |
| `/api/media/v1/…`            | media                                             |
| `/api/notification/v1/…`     | notification                                      |
| `/api/payment/v1/webhooks/…` | payment                                           |
| `/docs` ở dev                | một Swagger UI chọn Identity, Media, Notification |
| `/`                          | web-3d                                            |
| `/` trên cổng storage        | object storage                                    |
| `/ws/_probe/…`               | gateway-probe, chỉ dùng ở Compose và cụm local    |

Route `/ws/game` đã khai nhưng chưa bật vì game server chưa có. Bản Compose gốc và overlay staging không có UI tài liệu; Compose dev dùng thêm `infra/compose/compose.dev.yaml`, k3d local dùng component `api-docs`. Ba đặc tả hiển thị được sinh từ hợp đồng bằng `pnpm api-docs:render` và kiểm lệch bằng `pnpm api-docs:check`. Xem [cách vận hành cổng](../../docs/runbooks/gateway.md) để thêm route, chạy kiểm tra và chẩn đoán lỗi; xem [kiến trúc](../../docs/wiki/engineering/architecture.md) để biết vị trí cổng trong hệ thống.
