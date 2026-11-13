# ADR-0028: Giao tiếp giữa các service: định danh service, Kafka cho sự việc, gRPC cho mệnh lệnh

- Trạng thái: accepted
- Ngày: 2026-11-13
- Xem thêm: [ADR-0003](./ADR-0003-seven-services.md), [ADR-0024](./ADR-0024-identity-origin-and-shop-tenants.md), [ADR-0025](./ADR-0025-media-access-by-tenant-model.md), [ADR-0026](./ADR-0026-public-shop-media-and-tenant-creation.md), [ADR-0027](./ADR-0027-notification-service-origin-and-channels.md)

## Bối cảnh

Kiến trúc đã ghi Kafka là cách mặc định giữa các service và gRPC cho lời gọi đồng bộ lúc thật cần. Sau lúc identity, media và notification vào repo, thực tế còn thiếu bốn thứ:

- Identity chỉ cấp token cho người dùng. Một service gọi service khác chưa có cách xưng danh.
- `packages/nest-kit` có cổng phát sự kiện nhưng chỉ có bộ ghi log; chưa service nào đẩy sự kiện lên Kafka, chưa service nào nghe.
- `packages/contracts` chưa có hợp đồng gRPC nào.
- Notification gắn mọi dữ liệu với một tenant và từ chối token không gắn tenant, nên chưa gửi được gì cho tài khoản chưa thuộc tiệm nào.

Bốn thứ này dựa vào cùng một câu hỏi: service này là ai lúc gọi service kia. ADR này trả lời câu đó và chốt thứ tự làm.

## Quyết định

### Định danh service

1. Identity quản lý tài khoản của service. Mỗi tài khoản có mã, khoá bí mật chỉ hiện một lần lúc tạo và được lưu ở dạng băm, danh sách audience được phép và danh sách quyền. Chỉ quản trị nền tảng tạo, đổi khoá và thu hồi được.
2. Service đổi mã và khoá bí mật lấy token. Token ngắn hạn, không có refresh token, không gắn tenant, không mang vai trò, mang danh sách quyền và chỉ có audience mà service được cấp.
3. Quyền của service do nền tảng cấp, không do tenant đặt. Tenant không tạo được quyền này bằng vai trò hay permission của mình.
4. `packages/nest-kit` phân biệt token của người dùng và token của service, và có guard theo quyền. Route không khai quyền thì từ chối token của service, để service không đóng vai người dùng.
5. Service làm việc thay cho một tiệm thì nêu tiệm đó trong lời gọi. Bên nhận tin điều này vì bên gọi đã được xác thực là service và có quyền tương ứng.

### Sự việc qua Kafka

6. Điều đã xảy ra được phát thành sự kiện qua outbox rồi lên Kafka, theo vỏ chung. Bên phát không biết ai nghe.
7. Mỗi service một topic; khoá của thông điệp là phạm vi của sự kiện, để giữ thứ tự trong một tiệm. Job chuyển outbox phát theo đúng thứ tự ghi: một sự kiện chưa gửi được thì các sự kiện sau của service đó chờ, không vượt lên trước.
8. Broker lỗi không làm mất sự kiện. Sự kiện gửi lỗi được thử lại mãi, khoảng chờ tăng dần tới mười lăm phút; vượt số lần thử cấu hình thì service ghi log mức lỗi để người vận hành biết outbox đang nghẽn. Chỉ sự kiện sai hợp đồng mới bị gác lại, và bị gác ngay.
9. Sự kiện được kiểm theo hợp đồng trong `packages/contracts` trước lúc phát. Ở production service phải có hợp đồng sự kiện đã công bố và phải cấu hình Kafka, thiếu một trong hai thì không khởi động.
10. Bên nghe dùng một consumer group cho mỗi service, ghi lại mã sự kiện đã xử lý để chống trùng, và đưa sự kiện hỏng vào topic thư chết.
11. Sự kiện không mang bí mật. Mã một lần, token và khoá không đi qua Kafka.

### Mệnh lệnh qua gRPC

12. Việc bên gọi cần biết kết quả ngay, hoặc việc mang dữ liệu không được nằm lại trong log, đi qua gRPC. Ví dụ đầu tiên là identity nhờ notification gửi mã xác minh.
13. Hợp đồng gRPC nằm ở `packages/contracts/grpc/v1`. Kiểu dùng trong mã được sinh từ hợp đồng, và bước kiểm contracts liệt kê thay đổi theo [ADR-0029](./ADR-0029-contract-checks-ensure-consistency.md).
14. Máy chủ gRPC kiểm token của service gọi tới bằng khoá công khai của identity. Mọi mệnh lệnh có hạn chờ và khoá chống trùng.
15. Client vẫn gọi service qua HTTP.

### Phạm vi nền tảng

16. Dữ liệu không thuộc tiệm nào thuộc phạm vi nền tảng, mang mã dành riêng `platform`.
17. Token gắn tenant thì phạm vi là tenant đó; token của người dùng không gắn tenant thì phạm vi là `platform`. Việc quy đổi nằm ở một hàm trong `packages/nest-kit`.
18. Token mang tenant trùng mã dành riêng bị từ chối. Identity chỉ cấp mã tenant dạng UUID nên mã dành riêng không đến được từ một token hợp lệ.
19. Service không được suy phạm vi ngầm: mệnh lệnh từ một service thiếu phạm vi thì bị từ chối.
20. Notification lưu mã phạm vi trong cột tenant sẵn có, vì cột đó nằm trong khoá chính và mọi truy vấn của service đều lọc theo một giá trị bắt buộc có. Media giữ cách lưu hiện tại theo ADR-0025, tức để trống cho tệp không thuộc tiệm nào.
21. Ở notification: người chơi đọc hộp thư và đặt lựa chọn tắt nhận của chính mình trong phạm vi nền tảng; quản trị nền tảng quản lý template, thương hiệu và địa chỉ bị chặn của phạm vi đó.

### Thứ tự làm

22. Bốn đợt, mỗi đợt một issue và một PR: định danh service; sự kiện thật lên Kafka; gRPC và hợp đồng của nó; chuẩn hoá notification gồm phạm vi nền tảng, nhiều nhà cung cấp email, sửa các điểm bản soát ghi lại, và nối identity với notification.

## Hệ quả

- Khoá bí mật của service là bí mật vận hành mới. Mất khoá thì đổi khoá ở identity; token đã cấp còn dùng được tới lúc hết hạn, nên thời hạn token phải ngắn.
- Việc `shop` tạo tenant theo ADR-0026 dùng đúng cơ chế này, với một quyền riêng.
- Hai service lưu phạm vi nền tảng theo hai cách. Mã mới dùng hàm quy đổi chung và không tự so giá trị.
- Một người vừa là người chơi vừa là chủ tiệm đọc thông báo tài khoản bằng token không gắn tenant, và thông báo của tiệm bằng token của tiệm.
- Kafka và gRPC thêm hai thứ phải chạy và phải kiểm ở dev. Ngoài production, service vẫn khởi động được lúc không khai Kafka, với bộ phát ghi log.
- Giữ thứ tự bằng cách chờ nghĩa là một sự kiện kẹt làm nghẽn mọi sự kiện sau của service đó cho tới lúc broker trở lại. Đây là đánh đổi có chủ ý: chậm còn hơn sai thứ tự hoặc mất.
- Hai sự kiện ghi trong cùng một giao dịch có cùng thời điểm ghi, nên thứ tự giữa chúng không được bảo đảm. Hiện mỗi giao dịch của các service chỉ ghi một sự kiện cho một đối tượng.
- Sự kiện có thể tới bên nghe hơn một lần. Bên nghe chống trùng theo mã sự kiện, và việc xử lý phải làm lại được mà không sai.
- Sự kiện đăng ký và xác minh email mang địa chỉ email của tài khoản. Đây không phải bí mật theo điểm 11, nhưng là dữ liệu cá nhân nằm trên Kafka; phải xét lại lúc đặt thời gian lưu của topic.
