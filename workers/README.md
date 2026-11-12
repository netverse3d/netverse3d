# workers

Tiến trình xử lý việc nền.

Trang này được sinh từ `docs/catalog.yaml`. Muốn đổi thì sửa ở đó rồi chạy `pnpm docs:generate`.

| Thành phần | Loại | Stack | Vai trò | Milestone |
| --- | --- | --- | --- | --- |
| [`asset`](./asset/README.md) | worker | Chưa chốt | Xử lý GLB, nén, chuyển đổi asset | M2 |
| [`ai`](./ai/README.md) | worker | Python | Mô phỏng headless, huấn luyện và chạy bot học tăng cường; hàng đợi LLM, TTS | M6 |
| [`jobs`](./jobs/README.md) | worker | Chưa chốt | Gia hạn, dọn dữ liệu, thống kê định kỳ | M3 |
