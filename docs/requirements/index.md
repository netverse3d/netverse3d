# Sổ yêu cầu

Trang này được sinh từ `docs/requirements/registry.yaml`. Sửa trong tệp đó rồi chạy `pnpm docs:generate`.

## M0 · Nền móng

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-027 | Tách staging và production, phát hành theo tag | Đã chốt | Bắt buộc | `infra` |
| REQ-044 | Bố cục monorepo thống nhất và chỉ mục toàn repo | Đã chốt | Nên có | `infra` |

## M1 · Giao diện và Identity

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-001 | Đăng ký và đăng nhập bằng tài khoản | Đã chốt | Bắt buộc | `identity` |
| REQ-002 | Phân quyền theo vai trò người chơi, chủ tiệm, quản trị | Đã chốt | Bắt buộc | `identity` |
| REQ-003 | Tạo và chỉnh nhân vật | Nháp | Bắt buộc | `web-3d` |
| REQ-004 | Web 3D chạy trên máy tính và điện thoại | Đã chốt | Bắt buộc | `web-3d` |
| REQ-005 | Trang quản trị hệ thống | Nháp | Bắt buộc | `admin` |

## M2 · Lát cắt đầu

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-006 | Lưu trữ và phân phối asset 3D | Nháp | Bắt buộc | `media` |
| REQ-032 | Màn hình máy cá nhân | Đã chốt | Bắt buộc | `web-3d` |
| REQ-033 | Game đầu tiên trên máy | Nháp | Bắt buộc | `web-3d` |
| REQ-036 | Vào tiệm dựng sẵn và ngồi máy với room server giả | Đã chốt | Bắt buộc | `web-3d` |
| REQ-039 | Thế giới mang bối cảnh Sài Gòn cyber | Đã chốt | Nên có | `web-3d` |
| REQ-040 | Mỗi tiệm có bản sắc riêng | Đã chốt | Bắt buộc | `game-assets` |
| REQ-041 | Góc console trong tiệm | Nháp | Nên có | `game-assets` |

## M3 · Xèng và Payment

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-008 | Thông báo realtime, trong ứng dụng và email | Nháp | Bắt buộc | `notification` |
| REQ-010 | Thanh toán qua PayOS | Nháp | Bắt buộc | `payment` |
| REQ-011 | Thuê máy theo thời gian và gia hạn | Nháp | Bắt buộc | `core-api` |
| REQ-012 | Hoá đơn và lịch sử giao dịch | Nháp | Nên có | `payment` |
| REQ-028 | Tiền ảo Xèng nạp một chiều | Nháp | Bắt buộc | `payment` |
| REQ-029 | Sổ cái số dư ghi kép | Nháp | Bắt buộc | `payment` |
| REQ-031 | Phút miễn phí hằng ngày do hệ thống cấp | Nháp | Có thì tốt | `payment` |

## M4 · Chủ tiệm

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-007 | Người dùng tải lên ảnh và âm thanh có kiểm soát | Nháp | Nên có | `media` |
| REQ-009 | Chủ tiệm thuê đất để mở tiệm | Đã chốt | Bắt buộc | `core-api` |
| REQ-013 | Chủ tiệm xây dựng và bài trí tiệm | Đã chốt | Bắt buộc | `world` |
| REQ-014 | Người chơi khám phá và chọn tiệm bất kỳ | Đã chốt | Bắt buộc | `world` |
| REQ-015 | Duyệt tiệm và nội dung | Nháp | Nên có | `admin` |
| REQ-016 | Nâng cấp tiệm và danh tiếng | Nháp | Nên có | `core-api` |
| REQ-030 | Điểm doanh thu của chủ tiệm | Nháp | Bắt buộc | `core-api` |
| REQ-042 | Thành phố mở nhiều khu | Đã chốt | Nên có | `web-3d` |
| REQ-043 | Thời tiết ngẫu nhiên trong thành phố | Đã chốt | Nên có | `web-3d` |

## M5 · Tích hợp game core

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-017 | Vào tiệm và di chuyển đa người realtime | Đã chốt | Bắt buộc | `game` |
| REQ-018 | Ngồi vào máy và giữ chỗ không trùng | Đã chốt | Bắt buộc | `game` |
| REQ-019 | Từ 100 người trở lên trong một phòng | Nháp | Nên có | `game` |
| REQ-020 | Giao lưu giữa người chơi | Nháp | Nên có | `game` |
| REQ-021 | Máy bán nước và đồ ăn trong tiệm | Nháp | Có thì tốt | `game` |
| REQ-034 | Màn hình chung của tiệm | Nháp | Nên có | `game` |
| REQ-037 | Biểu cảm nhân vật khi chơi | Nháp | Nên có | `web-3d` |
| REQ-038 | Bot khách cho tiệm vắng | Nháp | Nên có | `game` |

## M6 · Bot học tăng cường

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-035 | Bot học tăng cường chơi game trên máy | Nháp | Nên có | `worker-ai` |

## M7 · Chatbot, TTS và NPC

| Mã | Yêu cầu | Trạng thái | Ưu tiên | Thành phần |
| --- | --- | --- | --- | --- |
| REQ-022 | Chatbot AI trên máy tính trong game | Nháp | Nên có | `ai-chat` |
| REQ-023 | Đọc hội thoại bằng TTS tiếng Việt | Nháp | Nên có | `ai-chat` |
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

Người chơi tạo nhân vật trước khi vào thế giới, tự chọn tóc, trang phục, phụ kiện và màu từng phần trên một bộ xương chung. Tài khoản lưu công thức nhân vật, có hồ sơ hiển thị với người khác.

Nguồn: `mentor-architecture-lite`, `mentor-demo`, `team-decision`

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

PayOS chỉ dùng để nạp Xèng. Webhook được xác thực và xử lý lặp an toàn. Chạy môi trường thử cho tới khi có quyết định khác.

Nguồn: `mentor-architecture-full`, `mentor-architecture-lite`

### REQ-011: Thuê máy theo thời gian và gia hạn

Người chơi trả Xèng theo từng block thời gian trả trước, giá do tiệm đặt; hết block thì gia hạn hoặc rời máy. Room server dừng giữa chừng không làm mất hay trừ thêm tiền. Sơ đồ ghi 1.000đ một máy; giá quy ra Xèng còn mở.

Nguồn: `mentor-architecture-lite`, `mentor-demo`

### REQ-012: Hoá đơn và lịch sử giao dịch

Người dùng và chủ tiệm xem được hoá đơn, lịch sử thanh toán của mình.

Nguồn: `mentor-architecture-lite`

### REQ-013: Chủ tiệm xây dựng và bài trí tiệm

Sau khi thuê đất, chủ tiệm vào chế độ xây dựng để đặt máy, bàn ghế, trang trí và chọn màu nhấn của tiệm.

Nguồn: `mentor-brief`, `mentor-architecture-lite`

### REQ-014: Người chơi khám phá và chọn tiệm bất kỳ

Người chơi xem danh sách tiệm, số máy còn trống, số người online và chọn tiệm để vào.

Nguồn: `mentor-brief`, `mentor-architecture-lite`

### REQ-015: Duyệt tiệm và nội dung

Quản trị viên duyệt tiệm và xử lý nội dung vi phạm.

Nguồn: `mentor-architecture-lite`

### REQ-016: Nâng cấp tiệm và danh tiếng

Tiệm có danh tiếng, chủ tiệm dùng điểm doanh thu để mở rộng không gian và thêm máy.

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

### REQ-028: Tiền ảo Xèng nạp một chiều

Người dùng nạp tiền thật để nhận Xèng và chỉ tiêu trong Netverse. Không rút, không chuyển cho người khác, không đổi ngược ra tiền. Xèng là tên tạm.

Nguồn: `team-decision`

### REQ-029: Sổ cái số dư ghi kép

Mọi thay đổi số dư Xèng và điểm doanh thu đi qua sổ cái ghi kép, không sửa số dư trực tiếp. Mỗi lần nạp gắn với mã đơn để webhook lặp lại không cộng hai lần.

Nguồn: `team-decision`

### REQ-030: Điểm doanh thu của chủ tiệm

Xèng người chơi trả cho giờ máy bị huỷ, hệ thống cấp điểm doanh thu cho chủ tiệm theo một tỷ lệ. Điểm chỉ dùng để thuê đất, mua máy, nâng cấp tiệm; không chuyển, không đổi ra Xèng. Chủ tiệm dùng máy tiệm mình không tạo điểm; bot khách tạo điểm có giới hạn theo REQ-038.

Nguồn: `team-decision`, `mentor-architecture-lite`

### REQ-031: Phút miễn phí hằng ngày do hệ thống cấp

Thay cho tặng phút giữa người chơi trong bản demo, hệ thống cấp một lượng thời gian miễn phí mỗi ngày.

Nguồn: `mentor-demo`, `team-decision`

### REQ-032: Màn hình máy cá nhân

Ngồi vào máy thì mở lớp màn hình 2D gồm game của Netverse, trình duyệt nhúng theo danh sách cho phép và video nhúng. Người khác thấy ảnh xem trước trên màn hình 3D của máy đó.

Nguồn: `mentor-demo`, `mentor-followup`

### REQ-033: Game đầu tiên trên máy

Một game web do nhóm tự thiết kế, chơi được trên màn hình máy. Luật game viết một lần dưới dạng bước tất định để dùng chung cho giao diện, huấn luyện và chấm điểm bot.

Nguồn: `mentor-followup`, `mentor-chat-arena`

### REQ-034: Màn hình chung của tiệm

Mỗi tiệm có màn hình lớn do chủ tiệm chọn nội dung như video xem chung, trận đấu đang diễn ra, bảng xếp hạng. Nội dung đồng bộ bằng trạng thái, mỗi máy tự hiển thị.

Nguồn: `mentor-followup`, `mentor-demo`

### REQ-035: Bot học tăng cường chơi game trên máy

Bot huấn luyện bằng học tăng cường trên mô phỏng headless, kiểm định độc lập rồi mới được vào tiệm. Bot ngồi máy, chơi và đấu với người, luôn hiện rõ là bot. Chỉ bot khách tạo điểm doanh thu, theo REQ-038.

Nguồn: `mentor-followup`, `mentor-chat-npc`, `mentor-chat-arena`

### REQ-036: Vào tiệm dựng sẵn và ngồi máy với room server giả

Trong lúc chờ core của mentor, người chơi vào một tiệm dựng sẵn bằng tài khoản khách, đi lại, thuê miễn phí và ngồi vào máy một mình trên room server giả theo giao thức nháp. Trừ Xèng được nối ở M3. Bản giả chỉ dùng để phát triển và test, không triển khai.

Nguồn: `team-decision`, `mentor-architecture-lite`

### REQ-037: Biểu cảm nhân vật khi chơi

Người chơi đổi được giữa mười hai biểu cảm khi đang chơi và người xung quanh nhìn thấy. Biểu cảm là trạng thái lúc chơi, không lưu trong công thức nhân vật.

Nguồn: `team-decision`

### REQ-038: Bot khách cho tiệm vắng

Tiệm vắng có bot khách đi lại, chọn máy và ngồi chơi như người, luôn hiện rõ là bot. Chỉ tiệm mới nhận điểm doanh thu từ bot khách, có trần theo ngày và thấp hơn nhiều so với khách thật.

Nguồn: `mentor-followup`, `team-decision`

### REQ-039: Thế giới mang bối cảnh Sài Gòn cyber

Một con hẻm và tiệm mẫu theo bối cảnh TP.HCM phiên bản cyber về đêm và chuẩn mỹ thuật ở ADR-0014, làm khuôn cho các khu sau này. Phố lắp từ module trên lưới ô đường 4 m, lô tiệm 8 × 8 m nhìn ra hẻm rộng 4 m. Có xe máy và ô tô đậu trước tiệm và chạy theo làn; người qua lại là bot robot trên vỉa hè. Đường chân trời gợi hình TP.HCM, không chép và không dùng tên công trình. Pháo hoa vào các dịp lễ Tết.

Nguồn: `team-decision`

### REQ-040: Mỗi tiệm có bản sắc riêng

Một con phố có nhiều tiệm và mỗi tiệm trông khác nhau. Hình dáng và màu của đồ đạc, gồm cả gradient nhiều màu như bàn phím, cùng bố cục, biển hiệu và kiểu đèn được lưu thành công thức của tiệm. Các tiệm dùng chung một bộ mô hình.

Nguồn: `team-decision`

### REQ-041: Góc console trong tiệm

Tiệm có thể có một góc giải trí riêng với sofa, bàn trà, máy console, tay cầm và TV lớn để người chơi ngồi chơi chung. Bộ mô hình dùng chung cơ chế ô đồ và đổi màu theo công thức tiệm; vị trí của góc này trong bố cục tiệm chốt sau.

Nguồn: `team-decision`

### REQ-042: Thành phố mở nhiều khu

Thế giới ngoài tiệm là một thành phố mở gồm nhiều khu nối nhau, người chơi đi bộ từ hẻm ra đường lớn. Đường có nhiều cấp, từ hẻm 4 m tới đại lộ nhiều làn, có ngã ba, ngã tư, vạch qua đường và đèn tín hiệu; xe chạy theo làn và theo đèn. Thành phố có lô đất, toà nhà phức hợp, công viên, sông và cầu. Công trình nổi tiếng chỉ gợi hình, mang tên riêng của Netverse, theo ADR-0014. Mọi thứ hiện trong thành phố là thành phần đã đăng ký trong thư viện 3D và dùng chung một chuẩn ánh sáng, đổ bóng, theo ADR-0019. Thành phố dựng theo từng đợt, đợt đầu là một khu mẫu có một trục đường lớn và một ngã tư có đèn.

Nguồn: `team-decision`

### REQ-043: Thời tiết ngẫu nhiên trong thành phố

Thành phố luôn là ban đêm theo ADR-0014, nhưng thời tiết đổi ngẫu nhiên theo thời gian giữa các trạng thái như tạnh, mưa nhẹ, mưa lớn và sương dày. Trạng thái chuyển dần, không đổi đột ngột. Người chơi ở cùng một khu thấy cùng một thời tiết. Mưa đi cùng mặt đường ướt và hạt mưa bắt sáng theo chuẩn dựng hình ở ADR-0019. Mức chất lượng thấp tắt được hiệu ứng mà không đổi trạng thái thời tiết.

Nguồn: `team-decision`

### REQ-044: Bố cục monorepo thống nhất và chỉ mục toàn repo

Mỗi thư mục cấp cao của repo có vai trò và quy tắc đặt tên được ghi rõ. Mọi thư mục cấp cao và mọi thành phần được khai ở một nơi, trang chỉ mục sinh từ đó và công cụ kiểm chặn khi lệch. Hợp đồng đặt phiên bản theo thư mục. Service giữ chuẩn chung qua hợp đồng và bộ kiểm chạy trên service thật, không phụ thuộc ngôn ngữ viết service, theo ADR-0020.

Nguồn: `team-decision`, `mentor-backend-sample`
