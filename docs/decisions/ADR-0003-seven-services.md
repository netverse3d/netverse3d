# ADR-0003: Dựng theo kiến trúc 7 service

- Trạng thái: accepted
- Ngày: 2026-11-07
- Xem thêm: [ADR-0020](./ADR-0020-monorepo-layout-and-index.md) đổi tên `core-api` thành `shop`

## Bối cảnh

Mentor đưa hai sơ đồ: bản đầy đủ 7 service có Kafka, Kubernetes và bản rút gọn 5 service. Bản rút gọn nhẹ hơn cho nhóm 4 người; thời gian làm đồ án trên 6 tháng.

## Quyết định

Theo bản đầy đủ: identity, shop, world, media, payment, ai-chat, notification; Kafka cho sự kiện; Kubernetes khi triển khai; Prometheus, Grafana, Loki, OpenTelemetry để quan sát.

## Hệ quả

- Khối lượng hạ tầng lớn, nên Milestone M0 dành riêng cho nền móng và Compose phải có smoke test.
- Mỗi service có cơ sở dữ liệu riêng và chỉ giao tiếp qua `packages/contracts`.
- Nếu hạ tầng ngốn quá nhiều thời gian, thay đổi phạm vi phải bằng một ADR mới.
