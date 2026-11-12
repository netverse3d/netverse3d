# nest-kit

Package dùng chung: Bộ khung dùng chung của các service NestJS, gồm response, lỗi, phân trang, xác thực, log.

- Stack dự kiến: NestJS
- Milestone: M1
- Trạng thái: chỉ giữ chỗ, chưa có mã

Package này chỉ phục vụ service viết bằng NestJS. Chuẩn chung cho mọi service, kể cả service viết bằng ngôn ngữ khác, nằm ở `packages/contracts` và được kiểm bằng `tests/conformance`, theo [ADR-0020](../../docs/decisions/ADR-0020-monorepo-layout-and-index.md).

Trước khi đưa mã vào đây, đọc [chuẩn thành phần](../../docs/wiki/engineering/component-standard.md).
