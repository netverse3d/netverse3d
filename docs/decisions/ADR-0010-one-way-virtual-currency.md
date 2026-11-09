# ADR-0010: Tiền ảo nạp một chiều, chủ tiệm nhận điểm doanh thu riêng

- Trạng thái: proposed
- Ngày: 2026-11-08

## Bối cảnh

Sơ đồ của mentor ghi PayOS và đơn giá 1.000đ một máy. Bản demo dùng phút chơi và cho người chơi tặng phút cho nhau. Nhóm muốn có tiền ảo riêng: nạp bằng tiền thật, chỉ dùng trong Netverse, không rút.

Theo các nguồn thứ cấp nhóm tìm được (chưa đối chiếu văn bản gốc, không phải tư vấn pháp lý):

- [Nghị định 147/2024](https://nhandan.vn/ocop/nghi-dinh-moi-cam-mua-ban-vat-pham-ao-trong-tro-choi-dien-tu-tren-mang-giua-nhung-nguoi-choi-post844806.html) không cho đổi đơn vị ảo ngược ra tiền và không cho mua bán vật phẩm ảo giữa người chơi.
- [Nghị định 52/2024](https://vneconomy.vn/to-chuc-cung-ung-vi-dien-tu-phai-co-von-toi-thieu-50-ty-dong.htm) coi việc giữ tiền hộ người khác dạng ví điện tử là dịch vụ trung gian thanh toán cần giấy phép.

Nếu Xèng của người chơi chảy thẳng vào ví chủ tiệm, hai tài khoản có thể thông đồng để chuyển Xèng cho nhau qua việc "thuê máy". Đó là chuyển giữa người chơi trá hình, mở đường cho mua bán Xèng lấy tiền mặt bên ngoài.

## Quyết định

- Tiền ảo tên tạm là **Xèng**. Trong mã dùng tên trung tính `Credit` để đổi tên hiển thị không phải đổi mã.
- Xèng chỉ có được bằng cách nạp qua PayOS hoặc do hệ thống cấp. Xèng chỉ tiêu, không rút, không chuyển cho người khác, không đổi ngược.
- Chủ tiệm nhận **điểm doanh thu** (`RevenuePoints`), không nhận Xèng. Khi người chơi trả Xèng cho giờ máy, Xèng bị huỷ và hệ thống cấp điểm cho chủ tiệm theo một tỷ lệ.
- Điểm doanh thu chỉ dùng để thuê đất, mua máy, nâng cấp tiệm. Không chuyển, không đổi ra Xèng, không đổi ra tiền.
- Chủ tiệm dùng máy ở tiệm mình không tạo điểm doanh thu.
- Bot khách tạo điểm doanh thu có giới hạn: có trần theo ngày, chỉ áp dụng cho tiệm mới, và thấp hơn nhiều so với khách thật. Nhờ vậy tiệm mới có điểm để lớn lên mà chủ tiệm không cày được điểm bằng bot.
- Tặng phút giữa người chơi bỏ, thay bằng phút miễn phí hằng ngày do hệ thống cấp.
- Giờ máy trả trước theo block. Room server dừng giữa chừng thì block đã trả không bị trừ thêm.
- Mọi thay đổi số dư đi qua sổ cái ghi kép do `services/payment` sở hữu.
- Khi bảo vệ đồ án chỉ chạy môi trường thử của PayOS.

## Hệ quả

- Không có đường nào đưa giá trị từ người chơi này sang người chơi khác.
- `payment` là nơi duy nhất sửa số dư. `core-api` gọi `payment` để trừ Xèng và chờ kết quả trước khi cấp block giờ máy; việc cấp điểm doanh thu đi qua sự kiện.
- Webhook nạp tiền phải xử lý lặp an toàn theo mã đơn và có outbox, để người đã trả tiền chắc chắn nhận Xèng.
- Còn mở:
  - Tên chính thức, tỷ giá Xèng, tỷ lệ cấp điểm, độ dài block.
  - Chủ tiệm mới chưa có điểm thì thuê khu đất đầu tiên bằng gì: Xèng, hay một khoản điểm khởi đầu do hệ thống cấp.
  - Có áp giới hạn giờ chơi cho người dưới 18 tuổi không.
  - Trần điểm từ bot khách là bao nhiêu, tiệm được coi là mới trong bao lâu.
- Nếu sau này chạy bằng tiền thật, cần người có chuyên môn pháp lý xem lại toàn bộ.

Liên quan: REQ-009, REQ-010, REQ-011, REQ-028, REQ-029, REQ-030, REQ-031, REQ-038.
