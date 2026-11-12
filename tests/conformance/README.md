# conformance

Bộ kiểm chuẩn chung của service. Bộ kiểm gọi HTTP thật vào một service đang chạy và đối chiếu với chuẩn trên dây trong `packages/contracts`: hình response, lỗi, phân trang, health, token.

- Không phụ thuộc ngôn ngữ viết service. Service NestJS, Go hay Python đều qua cùng một bộ.
- Service realtime chỉ chịu phần health, token, log và sự kiện.
- Trạng thái: chỉ giữ chỗ, chưa có mã. Bộ kiểm được dựng cùng lúc với service đầu tiên có mã.

Xem [ADR-0020](../../docs/decisions/ADR-0020-monorepo-layout-and-index.md).
