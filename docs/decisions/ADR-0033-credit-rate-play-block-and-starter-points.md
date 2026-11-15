# ADR-0033: Tỷ giá Xèng, block giờ máy 30 phút và điểm khởi đầu cho chủ tiệm mới

- Trạng thái: accepted
- Ngày: 2026-11-15
- Xem thêm: [ADR-0010](./ADR-0010-one-way-virtual-currency.md), [ADR-0021](./ADR-0021-two-real-money-flows.md)

## Bối cảnh

ADR-0010 để mở tên chính thức của tiền ảo, tỷ giá nạp, độ dài block giờ máy và cách chủ tiệm mới thuê khu đất đầu tiên khi chưa có điểm doanh thu. Service payment đã có đường nạp tiền qua PayOS nhưng REQ-010, REQ-028 và REQ-029 vẫn ở trạng thái nháp vì thiếu các số này.

Người dẫn dắt nhóm chốt ngày 2026-11-15.

## Quyết định

1. Tên hiển thị chính thức của tiền ảo là **Xèng**. Trong mã vẫn là `Credit`.
2. 1 Xèng bằng 1.000đ. Số dư Xèng là số nguyên, nên số tiền mỗi đơn nạp là bội của 1.000đ.
3. Giờ máy bán theo block trả trước dài 30 phút. Giá mỗi block do tiệm đặt bằng một số Xèng nguyên. Môi trường dev và môi trường thử được cấu hình block ngắn hơn để kiểm lúc hết giờ.
4. Mỗi chủ tiệm được hệ thống cấp điểm khởi đầu một lần, đủ để thuê lô đất nhỏ nhất. Khoản cấp này đi qua sổ cái ghi kép như mọi thay đổi điểm doanh thu khác.
5. Điểm khởi đầu là điểm doanh thu, nên theo luật của điểm: không chuyển, không đổi ra Xèng, không đổi ra tiền.

## Hệ quả

- REQ-010, REQ-028 và REQ-029 đủ điều kiện chuyển sang accepted.
- Đơn nạp có số tiền không chia hết cho 1.000đ bị từ chối lúc tạo đơn, không đợi tới webhook.
- Hai dòng tiền thật của ADR-0021 vẫn tách nhau: chủ tiệm mở được tiệm đầu tiên mà không phải nạp Xèng.
- Điểm khởi đầu là chỗ có thể bị lạm dụng bằng cách tạo nhiều tài khoản rồi thuê đất miễn phí.
- Còn mở:
  - Các gói nạp cụ thể.
  - Số điểm khởi đầu, phụ thuộc giá lô đất nhỏ nhất của REQ-009.
  - Cách chặn một người nhận điểm khởi đầu nhiều lần.
  - Tỷ lệ cấp điểm doanh thu khi người chơi trả giờ máy.

Liên quan: REQ-009, REQ-010, REQ-011, REQ-028, REQ-029, REQ-030.
