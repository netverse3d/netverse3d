# contracts

Hợp đồng dùng chung giữa các thành phần. Service chỉ nói chuyện với nhau qua những gì được khai ở đây.

| Thư mục     | Nội dung                                                            |
| ----------- | ------------------------------------------------------------------- |
| `openapi/`  | API HTTP, OpenAPI 3.1                                               |
| `events/`   | Sự kiện Kafka, JSON Schema. Mọi sự kiện dùng vỏ chung `envelope.v1` |
| `realtime/` | Giao thức giữa client và game server, JSON Schema                   |

## Đổi hợp đồng

- Thêm trường tuỳ chọn thì sửa trực tiếp.
- Xoá trường, đổi kiểu, thêm trường bắt buộc, xoá endpoint là thay đổi phá vỡ: tạo tệp phiên bản mới như `envelope.v2.schema.json`, giữ bản cũ cho tới khi không còn bên dùng.
- CI so với nhánh đích và chặn thay đổi phá vỡ, trừ hợp đồng còn đánh dấu `x-status: draft`.

`realtime/protocol.v1` hiện là nháp, chờ core của mentor. Xem [ADR-0004](../../docs/decisions/ADR-0004-game-core-boundary.md).

## Kiểm tra

```
pnpm --filter @netverse/contracts test
node packages/contracts/check.mjs --base origin/staging
```
