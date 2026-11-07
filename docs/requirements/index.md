# Sổ yêu cầu

Trang này được sinh từ `docs/requirements/registry.yaml`. Sửa trong tệp đó rồi chạy `pnpm docs:generate`.

## M0 · Nền móng

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-027 | Tách staging và production, phát hành theo tag | Đã chốt | Bắt buộc | `infra` |

## M1 · Giao diện và Identity

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-001 | Đăng ký và đăng nhập bằng tài khoản | Đã chốt | Bắt buộc | `identity` |
| REQ-002 | Phân quyền theo vai trò người chơi, chủ tiệm, quản trị | Đã chốt | Bắt buộc | `identity` |
| REQ-003 | Tạo và chỉnh nhân vật | Nháp | Bắt buộc | `web-3d` |
| REQ-004 | Web 3D chạy trên máy tính và điện thoại | Nháp | Bắt buộc | `web-3d` |
| REQ-005 | Trang quản trị hệ thống | Nháp | Bắt buộc | `admin` |

## M2 · Media và Notification

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-006 | Lưu trữ và phân phối asset 3D | Nháp | Bắt buộc | `media` |
| REQ-007 | Người dùng tải lên ảnh và âm thanh có kiểm soát | Nháp | Nên có | `media` |
| REQ-008 | Thông báo realtime, trong ứng dụng và email | Nháp | Bắt buộc | `notification` |

## M3 · Thuê đất và Payment

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-009 | Chủ tiệm thuê đất để mở tiệm | Đã chốt | Bắt buộc | `core-api` |
| REQ-010 | Thanh toán qua PayOS | Nháp | Bắt buộc | `payment` |
| REQ-011 | Thuê máy theo thời gian và gia hạn | Nháp | Bắt buộc | `payment` |
| REQ-012 | Hoá đơn và lịch sử giao dịch | Nháp | Nên có | `payment` |

## M4 · Xây tiệm và thế giới

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-013 | Chủ tiệm xây dựng và bài trí tiệm | Đã chốt | Bắt buộc | `world` |
| REQ-014 | Người chơi khám phá và chọn tiệm bất kỳ | Đã chốt | Bắt buộc | `world` |
| REQ-015 | Duyệt tiệm và nội dung | Nháp | Nên có | `admin` |
| REQ-016 | Nâng cấp tiệm và danh tiếng | Nháp | Nên có | `core-api` |

## M5 · Tích hợp game core

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-017 | Vào tiệm và di chuyển đa người realtime | Đã chốt | Bắt buộc | `game` |
| REQ-018 | Ngồi vào máy và giữ chỗ không trùng | Đã chốt | Bắt buộc | `game` |
| REQ-019 | Từ 100 người trở lên trong một phòng | Nháp | Nên có | `game` |
| REQ-020 | Giao lưu giữa người chơi | Nháp | Nên có | `game` |
| REQ-021 | Máy bán nước và đồ ăn trong tiệm | Nháp | Có thì tốt | `game` |

## M6 · Chatbot và TTS

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-022 | Chatbot AI trên máy tính trong game | Nháp | Nên có | `ai-chat` |
| REQ-023 | Đọc hội thoại bằng TTS tiếng Việt | Nháp | Nên có | `ai-chat` |

## M7 · NPC học tăng cường

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-024 | NPC phục vụ quán net huấn luyện bằng Reinforcement Learning | Nháp | Có thì tốt | `worker-ai` |

## M8 · Production

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-025 | Quan sát hệ thống bằng metric, log và trace | Nháp | Nên có | `infra` |
| REQ-026 | Triển khai production trên Kubernetes | Nháp | Bắt buộc | `infra` |

## Chi tiết

### REQ-001: Đăng ký và đăng nhập bằng tài khoản

Người dùng tạo tài khoản, đăng nhập và duy trì phiên làm việc an toàn.

Nguồn: `mentor-architecture-full`, `mentor-architecture-lite`, `mentor-demo`

### REQ-002: Phân quyền theo vai trò người chơi, chủ tiệm, quản trị

Một người dùng có thể vừa là người chơi vừa là chủ tiệm; quản trị là vai trò riêng.

Nguồn: `mentor-brief`, `mentor-architecture-full`

### REQ-003: Tạo và chỉnh nhân vật

Người chơi tạo nhân vật trước khi vào thế giới, có hồ sơ hiển thị với người khác.

Nguồn: `mentor-architecture-lite`, `mentor-demo`

### REQ-004: Web 3D chạy trên máy tính và điện thoại

Giao diện 3D dùng được trên trình duyệt máy tính và trên điện thoại dạng PWA, có điều khiển phím và cần ảo.

Nguồn: `mentor-architecture-full`, `mentor-architecture-lite`, `mentor-demo`

### REQ-005: Trang quản trị hệ thống

Quản trị viên quản lý người dùng, xem thống kê và cấu hình hệ thống.

Nguồn: `mentor-architecture-full`, `mentor-architecture-lite`, `mentor-demo`

### REQ-006: Lưu trữ và phân phối asset 3D

Quản lý GLB, texture, âm thanh, hoạt ảnh và metadata trên object storage chuẩn S3, phân phối được qua CDN. Sơ đồ ghi MinIO; sản phẩm cụ thể còn là câu hỏi mở.

Nguồn: `mentor-architecture-full`, `mentor-architecture-lite`

### REQ-007: Người dùng tải lên ảnh và âm thanh có kiểm soát

Giới hạn định dạng, dung lượng và có đường xử lý nội dung vi phạm.

Nguồn: `mentor-demo`

### REQ-008: Thông báo realtime, trong ứng dụng và email

Người dùng nhận được thông báo về thanh toán, gia hạn và sự kiện của tiệm.

Nguồn: `mentor-architecture-full`, `mentor-architecture-lite`

### REQ-009: Chủ tiệm thuê đất để mở tiệm

Muốn mở tiệm net, người dùng phải thuê một khu đất trong thế giới trước.

Nguồn: `mentor-brief`, `mentor-architecture-full`

### REQ-010: Thanh toán qua PayOS

Thanh toán có webhook được xác thực và xử lý lặp an toàn. Phạm vi tiền thật còn là câu hỏi mở.

Nguồn: `mentor-architecture-full`, `mentor-architecture-lite`

### REQ-011: Thuê máy theo thời gian và gia hạn

Người chơi trả phí để dùng máy trong một khoảng thời gian; hết giờ thì kết thúc phiên. Đơn giá trong ảnh là 1.000đ một máy.

Nguồn: `mentor-architecture-lite`, `mentor-demo`

### REQ-012: Hoá đơn và lịch sử giao dịch

Người dùng và chủ tiệm xem được hoá đơn, lịch sử thanh toán của mình.

Nguồn: `mentor-architecture-lite`

### REQ-013: Chủ tiệm xây dựng và bài trí tiệm

Sau khi thuê đất, chủ tiệm vào chế độ xây dựng để đặt máy, bàn ghế và trang trí.

Nguồn: `mentor-brief`, `mentor-architecture-lite`

### REQ-014: Người chơi khám phá và chọn tiệm bất kỳ

Người chơi xem danh sách tiệm, số máy còn trống, số người online và chọn tiệm để vào.

Nguồn: `mentor-brief`, `mentor-architecture-lite`

### REQ-015: Duyệt tiệm và nội dung

Quản trị viên duyệt tiệm và xử lý nội dung vi phạm.

Nguồn: `mentor-architecture-lite`

### REQ-016: Nâng cấp tiệm và danh tiếng

Tiệm có danh tiếng, chủ tiệm mở rộng không gian, thêm máy từ kết quả kinh doanh.

Nguồn: `mentor-architecture-full`, `mentor-architecture-lite`

### REQ-017: Vào tiệm và di chuyển đa người realtime

Nhiều người chơi cùng ở trong một tiệm, thấy nhau di chuyển với độ trễ thấp, server có thẩm quyền.

Nguồn: `mentor-brief`, `mentor-architecture-full`, `mentor-demo`

### REQ-018: Ngồi vào máy và giữ chỗ không trùng

Một máy chỉ có một người dùng tại một thời điểm, kể cả khi nhiều người tranh cùng lúc.

Nguồn: `mentor-brief`, `mentor-architecture-full`, `mentor-demo`

### REQ-019: Từ 100 người trở lên trong một phòng

Một phòng giữ được tối thiểu 100 người chơi ổn định; game server mở rộng được theo chiều ngang.

Nguồn: `mentor-architecture-full`, `mentor-architecture-lite`

### REQ-020: Giao lưu giữa người chơi

Người chơi trò chuyện và kết bạn trong tiệm. Phạm vi chat, voice còn là câu hỏi mở.

Nguồn: `mentor-architecture-lite`, `mentor-demo`

### REQ-021: Máy bán nước và đồ ăn trong tiệm

Người chơi mua đồ ăn thức uống ảo từ máy bán hàng trong tiệm.

Nguồn: `mentor-architecture-lite`

### REQ-022: Chatbot AI trên máy tính trong game

Người chơi ngồi vào máy và trò chuyện với chatbot dùng LLM chạy local.

Nguồn: `mentor-architecture-full`, `mentor-architecture-lite`

### REQ-023: Đọc hội thoại bằng TTS tiếng Việt

Hội thoại của chatbot và NPC được đọc bằng giọng tiếng Việt chạy local.

Nguồn: `mentor-architecture-full`, `mentor-architecture-lite`

### REQ-024: NPC phục vụ quán net huấn luyện bằng Reinforcement Learning

Bắt đầu từ một NPC giao đồ trong quán, huấn luyện trên mô phỏng headless, kiểm định độc lập rồi mới đưa vào tiệm.

Nguồn: `mentor-chat-npc`, `mentor-chat-arena`

### REQ-025: Quan sát hệ thống bằng metric, log và trace

Có Prometheus, Grafana, Loki và OpenTelemetry cho mọi service.

Nguồn: `mentor-architecture-full`

### REQ-026: Triển khai production trên Kubernetes

Hệ thống chạy trên Kubernetes, có Kafka cho sự kiện và hàng đợi việc nền.

Nguồn: `mentor-architecture-full`, `team-decision`

### REQ-027: Tách staging và production, phát hành theo tag

Mọi thay đổi được test trên staging trước; tag kích hoạt phát hành, ai trong nhóm cũng phát hành được nếu đúng quy trình.

Nguồn: `team-decision`
