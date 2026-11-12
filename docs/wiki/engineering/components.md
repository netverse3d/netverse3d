# Danh sách thành phần

Trang này được sinh từ `docs/catalog.yaml`.

| Đường dẫn | Loại | Stack | Vai trò | Milestone |
| --- | --- | --- | --- | --- |
| `apps/web-3d` | app | Next.js, Three.js | Web 3D và PWA cho người chơi và chủ tiệm | M1 |
| `apps/admin` | app | Next.js | Quản trị hệ thống | M1 |
| `services/identity` | service | NestJS, Prisma | Đăng ký, đăng nhập, JWT, RBAC | M1 |
| `services/shop` | service | NestJS, Prisma | Người dùng, tiệm, máy, thuê đất, giờ máy, điểm doanh thu, cấu hình | M3 |
| `services/world` | service | NestJS, Prisma | Thế giới, bản đồ, bố cục, phòng net | M4 |
| `services/media` | service | NestJS, Prisma | Asset 3D, ảnh, âm thanh, metadata, object storage chuẩn S3, CDN | M2 |
| `services/payment` | service | NestJS, Prisma | PayOS, nạp Xèng, sổ cái số dư, webhook, hoá đơn | M3 |
| `services/ai-chat` | service | Python | Chatbot LLM chạy local và TTS tiếng Việt | M7 |
| `services/notification` | service | NestJS, Prisma | Thông báo realtime, email, trong ứng dụng | M3 |
| `services/game` | service | Chưa chốt, chờ core của mentor | Game Gateway và Authoritative Room Server | M5 |
| `workers/asset` | worker | Chưa chốt | Xử lý GLB, nén, chuyển đổi asset | M2 |
| `workers/ai` | worker | Python | Mô phỏng headless, huấn luyện và chạy bot học tăng cường; hàng đợi LLM, TTS | M6 |
| `workers/jobs` | worker | Chưa chốt | Gia hạn, dọn dữ liệu, thống kê định kỳ | M3 |
| `packages/contracts` | package | OpenAPI, JSON Schema | Hợp đồng HTTP, sự kiện Kafka và giao thức realtime | M0 |
| `packages/game-shared` | package | TypeScript | Luật di chuyển và va chạm dùng chung giữa client và game server | M2 |
| `packages/ui` | package | React | Thành phần giao diện dùng chung | M1 |
| `packages/config` | package | TypeScript | Cấu hình dùng chung cho lint, TypeScript | M1 |
| `packages/game-assets` | package | Blender, glTF | Tệp Blender gốc, mô hình xuất ra và bộ kiểm của nhân vật, đồ vật | M1 |
