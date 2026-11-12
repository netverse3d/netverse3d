# ADR-0021: Hai dòng tiền thật: người chơi nạp Xèng, chủ tiệm mua license máy

- Trạng thái: accepted
- Ngày: 2026-11-12
- Xem thêm: [ADR-0010](./ADR-0010-one-way-virtual-currency.md)

## Bối cảnh

[ADR-0010](./ADR-0010-one-way-virtual-currency.md) chỉ có một dòng tiền thật: người chơi nạp Xèng qua PayOS. Chủ tiệm không trả tiền thật; họ nhận điểm doanh thu và dùng điểm để thuê đất, mua máy, nâng cấp tiệm.

Bản backend mẫu của mentor (nguồn `mentor-backend-sample`) đi theo hướng khác: chủ tiệm trả tiền thật để có quyền kích hoạt một số máy trong một chu kỳ, và tiệm chỉ bật được số máy không vượt quyền đang còn hạn. Sơ đồ ban đầu của mentor cũng ghi đơn giá 1.000đ một máy.

Hai mô hình cùng nói về máy. Nếu giữ cả "mua máy bằng điểm" lẫn "trả tiền để bật máy" thì một máy chịu hai loại phí và chủ tiệm mới không có điểm để mua máy đầu tiên.

Người dẫn dắt nhóm chốt ngày 2026-11-12: giữ Xèng cho người chơi, thêm license máy trả bằng tiền thật cho chủ tiệm, và license thay cho việc mua máy bằng điểm doanh thu.

## Quyết định

1. Hệ thống có hai dòng tiền thật, cùng đi qua PayOS và cùng do `services/payment` sở hữu.

   | Dòng        | Ai trả     | Nhận được gì                                       | Dùng để làm gì         |
   | ----------- | ---------- | -------------------------------------------------- | ---------------------- |
   | Nạp Xèng    | Người chơi | Xèng, theo ADR-0010                                | Trả giờ máy trong tiệm |
   | License máy | Chủ tiệm   | Quyền bật một số máy của một tiệm trong một chu kỳ | Mở máy cho khách ngồi  |

2. License máy gắn với một tiệm, ghi số máy được bật và ngày hết hạn. Mua thêm thì cộng số máy và kéo dài hạn. Tên trong mã là `MachineLicense`.
3. Tiệm chỉ bật được số máy không vượt license còn hạn. `services/shop` kiểm điều này lúc bật máy, dựa trên bản sao quyền mà nó nhận qua sự kiện từ `payment`.
4. License thay cho việc mua máy bằng điểm doanh thu. Điểm doanh thu chỉ còn dùng để thuê đất, nâng cấp và bài trí tiệm.
5. Hai dòng không chạm nhau. Mua license không tạo ra Xèng hay điểm doanh thu. Xèng và điểm doanh thu không dùng để trả license. License không chuyển cho tiệm khác, không hoàn lại thành tiền.
6. Quyền chỉ được cấp sau lúc webhook được xác thực và số tiền khớp đơn. Xử lý phải an toàn với webhook lặp, ghi sổ cái và sự kiện trong cùng một giao dịch.
7. Giá mẫu lấy theo mentor: 1.000đ cho một máy trong 30 ngày. Đây là số để dựng và thử, chưa phải giá chốt.
8. Như ADR-0010, lúc bảo vệ đồ án chỉ chạy môi trường thử của PayOS.

## Hệ quả

- `payment` có hai loại đơn. Mã đơn, webhook, sổ cái và outbox dùng chung một đường xử lý; loại đơn quyết định kết quả là cộng Xèng hay cấp license.
- Cần một hợp đồng sự kiện báo license của tiệm thay đổi để `shop` cập nhật bản sao quyền.
- REQ-010 không còn giới hạn PayOS cho riêng việc nạp Xèng. REQ-030 và ADR-0010 bỏ phần mua máy bằng điểm.
- Chủ tiệm mới bật được máy ngay sau lúc mua license, không phải chờ có điểm doanh thu. Câu hỏi thuê khu đất đầu tiên bằng gì vẫn mở ở ADR-0010.
- Còn mở:
  - Giá và độ dài chu kỳ chính thức.
  - Có tính theo ngày còn lại, ân hạn hay gia hạn tự động không.
  - License hết hạn thì các máy đang bật xử lý thế nào, người đang ngồi có bị ngắt không.
  - Giảm số máy giữa chu kỳ có được không.
- Nếu sau này chạy bằng tiền thật, cần người có chuyên môn pháp lý xem lại cùng với ADR-0010.

Liên quan: REQ-010, REQ-011, REQ-029, REQ-030, REQ-045.
