# contracts

Hợp đồng dùng chung giữa các thành phần. Service chỉ nói chuyện với nhau qua những gì được khai ở đây.

| Thư mục     | Nội dung                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `openapi/`  | API HTTP, OpenAPI 3.1                                                                          |
| `events/`   | Sự kiện Kafka, JSON Schema. Mọi sự kiện dùng vỏ chung `events/v1/envelope`                     |
| `realtime/` | Giao thức giữa client và game server, JSON Schema                                              |
| `world/`    | Dữ liệu thế giới game: công thức tiệm `shop-look`, khối phố `street-block` (nháp), JSON Schema |

## Phiên bản

Mỗi loại hợp đồng có thư mục phiên bản: `<loại>/v<N>/<tên>`, ví dụ `events/v1/envelope.schema.json`. Tên tệp không mang số phiên bản. Theo [ADR-0020](../../docs/decisions/ADR-0020-monorepo-layout-and-index.md).

## Đổi hợp đồng

- Thêm trường tuỳ chọn thì sửa trực tiếp.
- Xoá trường, đổi kiểu, thêm trường bắt buộc, xoá endpoint là thay đổi phá vỡ: tạo tệp trong thư mục phiên bản mới như `events/v2/envelope.schema.json`, giữ bản cũ cho tới khi không còn bên dùng.
- CI so với nhánh đích và chặn thay đổi phá vỡ, trừ hợp đồng còn đánh dấu `x-status: draft`.

`realtime/v1/protocol` hiện là nháp, chờ core của mentor. Xem [ADR-0004](../../docs/decisions/ADR-0004-game-core-boundary.md).

## Hợp đồng hiện có

| Tệp                                 | Của ai      | Trạng thái |
| ----------------------------------- | ----------- | ---------- |
| `openapi/v1/health.yaml`            | mọi service | chính thức |
| `openapi/v1/media.yaml`             | media       | chính thức |
| `events/v1/envelope.schema.json`    | mọi sự kiện | chính thức |
| `events/v1/media.schema.json`       | media       | nháp       |
| `realtime/v1/protocol.schema.json`  | game        | nháp       |
| `world/v1/shop-look.schema.json`    | game-assets | nháp       |
| `world/v1/street-block.schema.json` | game-assets | nháp       |

## Kiểm tra

```
pnpm --filter @netverse/contracts test
node packages/contracts/check.mjs --base origin/staging
```
