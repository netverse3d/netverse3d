# services

Tiến trình phục vụ API hoặc kết nối realtime, mỗi service một thư mục.

Trang này được sinh từ `docs/catalog.yaml`. Muốn đổi thì sửa ở đó rồi chạy `pnpm docs:generate`.

| Thành phần | Loại | Stack | Vai trò | Milestone |
| --- | --- | --- | --- | --- |
| [`identity`](./identity/README.md) | service | NestJS, Prisma | Đăng ký, đăng nhập, JWT, RBAC | M1 |
| [`shop`](./shop/README.md) | service | NestJS, Prisma | Người dùng, tiệm, máy, thuê đất, giờ máy, điểm doanh thu, cấu hình | M3 |
| [`world`](./world/README.md) | service | NestJS, Prisma | Thế giới, bản đồ, bố cục, phòng net | M4 |
| [`media`](./media/README.md) | service | NestJS, Prisma, PostgreSQL, object storage chuẩn S3 | Asset 3D, ảnh, âm thanh, metadata, object storage chuẩn S3, CDN | M2 |
| [`payment`](./payment/README.md) | service | NestJS, Prisma | PayOS, nạp Xèng, sổ cái số dư, webhook, hoá đơn | M3 |
| [`ai-chat`](./ai-chat/README.md) | service | Python | Chatbot LLM chạy local và TTS tiếng Việt | M7 |
| [`notification`](./notification/README.md) | service | NestJS, Prisma | Thông báo realtime, email, trong ứng dụng | M3 |
| [`game`](./game/README.md) | service | Go theo bản mẫu của mentor, chưa nhận mã | Game Gateway và Authoritative Room Server | M5 |
