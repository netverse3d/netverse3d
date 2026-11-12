# packages

Mã và dữ liệu dùng chung, không tự triển khai.

Trang này được sinh từ `docs/catalog.yaml`. Muốn đổi thì sửa ở đó rồi chạy `pnpm docs:generate`.

| Thành phần | Loại | Stack | Vai trò | Milestone |
| --- | --- | --- | --- | --- |
| [`contracts`](./contracts/README.md) | package | OpenAPI, JSON Schema | Hợp đồng HTTP, sự kiện Kafka và giao thức realtime | M0 |
| [`game-shared`](./game-shared/README.md) | package | TypeScript | Luật di chuyển và va chạm dùng chung giữa client và game server | M2 |
| [`ui`](./ui/README.md) | package | React | Thành phần giao diện dùng chung | M1 |
| [`config`](./config/README.md) | package | TypeScript | Cấu hình dùng chung cho lint, TypeScript | M1 |
| [`game-assets`](./game-assets/README.md) | package | Blender, glTF | Tệp Blender gốc, mô hình xuất ra và bộ kiểm của nhân vật, đồ vật | M1 |
