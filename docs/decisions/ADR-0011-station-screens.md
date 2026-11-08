# ADR-0011: Màn hình máy là lớp 2D, màn hình chung đồng bộ bằng trạng thái

- Trạng thái: proposed
- Ngày: 2026-11-08

## Bối cảnh

Mentor gợi ý trên máy có thể dùng trình duyệt hoặc app thật như trên desktop, và có màn hình chung cho cả quán.

Bản demo mở một khung trình duyệt 2D dạng `iframe` có `sandbox` khi người chơi ngồi vào máy. Link YouTube và TikTok được đổi sang bản nhúng; link khác đưa thẳng vào khung. Người khác thấy ảnh xem trước của màn hình đó.

Nhiều trang từ chối hiện trong `iframe`, nên khung nhúng không phải trình duyệt thật. Chạy Chrome trên server rồi gửi hình về dạng video, như [neko](https://github.com/m1k1o/neko) hoặc [Hyperbeam](https://hyperbeam.com), mở được mọi trang nhưng tốn khoảng 1–2 vCPU và 1–2 GB RAM mỗi phiên (ước tính, chưa đo). Mỗi ghế một phiên thì 100 người cần khoảng 100–200 vCPU.

## Quyết định

- Máy cá nhân: ngồi vào thì mở lớp màn hình 2D (`Desktop`) gồm game của Netverse, trình duyệt nhúng theo danh sách cho phép và video nhúng. Người khác chỉ thấy ảnh xem trước, cập nhật thưa.
- Màn hình chung của tiệm (`ShopScreen`): đồng bộ trạng thái như mã video và thời điểm, hoặc trạng thái trận đấu; mỗi máy tự hiển thị. Không gửi video từ server.
- Chủ tiệm chọn nội dung màn hình chung.
- Không làm proxy để gỡ chặn nhúng của trang khác.
- Chrome chạy trên server để sau. Nếu cần thì giới hạn một phiên mỗi tiệm.

## Hệ quả

- Chi phí server cho màn hình gần như bằng 0.
- Trình duyệt trên máy không mở được mọi trang. Danh sách cho phép cần quản trị viên duy trì.
- Giao thức realtime cần thêm tin nhắn cho ảnh xem trước và trạng thái màn hình chung.

Liên quan: REQ-032, REQ-034.
