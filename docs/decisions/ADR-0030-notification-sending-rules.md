# ADR-0030: Luật gửi của notification: loại template, hạn mức của tiệm, hạn của thông báo

- Trạng thái: accepted
- Ngày: 2026-11-14
- Xem thêm: [ADR-0027](./ADR-0027-notification-service-origin-and-channels.md), [ADR-0028](./ADR-0028-service-to-service-communication.md)

## Bối cảnh

Bản soát mã của notification để lại ba điểm cần quyết về nghiệp vụ:

- Lựa chọn tắt nhận gắn với mã người nhận. Một lần gửi chỉ có địa chỉ email thì service không biết địa chỉ đó của ai, nên bỏ qua lựa chọn tắt nhận.
- Quản trị tiệm tự đặt tiêu đề và nội dung, rồi gửi từ địa chỉ chung của hệ thống tới địa chỉ bất kỳ. Một tiệm gửi thư rác làm giảm uy tín tên miền chung, kéo theo mã xác minh của mọi người vào hộp thư rác.
- Thư đang chờ được thử lại tới một ngày. Mã xác minh chỉ có giá trị vài phút, gửi muộn là vô nghĩa.

## Quyết định

### Loại template

1. Mỗi template mang một loại: `TRANSACTIONAL` cho thư mà người nhận cần để dùng dịch vụ, như mã xác minh; `OPTIONAL` cho mọi thư còn lại.
2. Thư loại `TRANSACTIONAL` luôn được gửi, không xét lựa chọn tắt nhận. Danh sách địa chỉ bị chặn vẫn áp dụng.
3. Thư loại `OPTIONAL` bắt buộc có mã người nhận. Lệnh gửi chỉ có địa chỉ hoặc chỉ có token thiết bị bị từ chối ngay lúc nhận lệnh, để lựa chọn tắt nhận luôn xét được.
4. Chỉ phạm vi nền tảng có template loại `TRANSACTIONAL`. Template của tiệm luôn là `OPTIONAL`, vì tiệm tự đánh dấu được thì phép phân loại không còn chặn được gì. Hệ quả: tiệm chỉ gửi được tới người có tài khoản.
5. Template không khai loại thì là `OPTIONAL`.

### Hạn mức và tên người gửi của tiệm

6. Mỗi tiệm có hạn mức email trong 24 giờ, cấu hình bằng `TENANT_DAILY_EMAIL_LIMIT`. Vượt hạn mức thì lệnh gửi qua HTTP bị từ chối với mã 429. Hạn mức không áp cho phạm vi nền tảng và cho lệnh từ service.
7. Email của một tiệm mang tên người gửi là tên thương hiệu của tiệm, lấy từ mục thương hiệu `name`. Tiệm chưa đặt tên thì dùng tên chung của hệ thống.

### Hạn của thông báo

8. Bên gọi có thể đưa kèm thời điểm hết hạn. Quá hạn thì lần gửi bị loại với lý do `EXPIRED`, không gửi muộn.
9. Thời điểm hết hạn không nằm trong phép so khoá chống trùng, để bên gọi gửi lại cùng một lệnh với hạn mới mà không bị coi là lệnh khác.
10. Lần gửi đang chờ vì nhà cung cấp từ chối khoá thì chờ tới hạn của thông báo, và không quá một ngày kể từ lúc tạo.

## Hệ quả

- Tiệm muốn gửi thư tới người chưa có tài khoản thì chưa làm được. Việc này cần tắt nhận theo địa chỉ và link huỷ đăng ký, để sau.
- Hạn mức đếm theo số lần gửi đã ghi, nên các lệnh tới cùng lúc có thể vượt hạn mức một ít.
- Tên thương hiệu do tiệm tự đặt, nên một tiệm vẫn có thể đặt tên gây nhầm lẫn. Địa chỉ gửi vẫn là địa chỉ chung; tên miền gửi riêng cho từng tiệm để sau.
- Identity đặt hạn của thông báo bằng hạn của mã xác minh lúc chuyển sang gửi qua notification.
