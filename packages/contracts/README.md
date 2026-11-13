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

- Hợp đồng được sửa trực tiếp, theo [ADR-0029](../../docs/decisions/ADR-0029-contract-checks-ensure-consistency.md). Đổi hợp đồng thì sửa luôn mọi bên dùng nó trong cùng PR.
- `pnpm --filter @netverse/contracts check -- --base origin/staging` liệt kê thay đổi so với nhánh gốc: xoá trường, đổi kiểu, thêm trường bắt buộc, xoá endpoint, xoá tệp. Danh sách này để người duyệt PR đọc, không làm bước kiểm đỏ.
- Bước kiểm chỉ đỏ lúc hợp đồng sai cú pháp, thiếu thông tin bắt buộc, đặt tên sai quy ước, hoặc một tệp `.proto` lấy số của field đã bỏ để đặt cho field khác kiểu.
- Mở thư mục phiên bản mới như `events/v2` lúc cần hai bản chạy song song.

`realtime/v1/protocol` hiện là nháp, chờ core của mentor. Xem [ADR-0004](../../docs/decisions/ADR-0004-game-core-boundary.md).

## Hợp đồng hiện có

| Tệp                                  | Của ai       | Trạng thái |
| ------------------------------------ | ------------ | ---------- |
| `openapi/v1/health.yaml`             | mọi service  | chính thức |
| `openapi/v1/identity.yaml`           | identity     | chính thức |
| `openapi/v1/media.yaml`              | media        | chính thức |
| `openapi/v1/notification.yaml`       | notification | chính thức |
| `events/v1/envelope.schema.json`     | mọi sự kiện  | chính thức |
| `events/v1/identity.schema.json`     | identity     | nháp       |
| `events/v1/media.schema.json`        | media        | nháp       |
| `events/v1/notification.schema.json` | notification | nháp       |
| `realtime/v1/protocol.schema.json`   | game         | nháp       |
| `world/v1/shop-look.schema.json`     | game-assets  | nháp       |
| `world/v1/street-block.schema.json`  | game-assets  | nháp       |

## Kiểm tra

```
pnpm --filter @netverse/contracts test
node packages/contracts/check.mjs --base origin/staging
```
