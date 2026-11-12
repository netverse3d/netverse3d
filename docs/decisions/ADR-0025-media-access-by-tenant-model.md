# ADR-0025: Quyền trên media theo mô hình tenant, duyệt nội dung là quyền nền tảng

- Trạng thái: accepted
- Ngày: 2026-11-12
- Xem thêm: [ADR-0023](./ADR-0023-media-service-origin-and-object-storage.md), [ADR-0024](./ADR-0024-identity-origin-and-shop-tenants.md)

## Bối cảnh

[ADR-0024](./ADR-0024-identity-origin-and-shop-tenants.md) chốt mỗi tiệm là một tenant, vai trò trong tenant do tiệm tự đặt, người chơi dùng token không gắn tenant, quản trị là quyền nền tảng. Media được viết trước mô hình này và quyết quyền bằng cách so tên vai trò `admin` trong token. Lúc media nhận token thật của identity, cách đó sinh ba lỗ hổng:

- Vai trò `admin` do tiệm tự đặt, nên chủ tiệm tự duyệt được nội dung của tiệm mình và tự tạo được asset hệ thống. Tệp của người chơi thì không ai duyệt được, vì token không gắn tenant không bao giờ mang vai trò `admin`.
- Mọi người chơi dùng chung một phạm vi không gắn tenant, nên thấy được tệp nội bộ của nhau và tải lên được dưới mã chủ sở hữu của người khác.
- Tenant từng đặt được vai trò trùng tên vai trò nền tảng. Việc này đã được chặn ở identity, nhưng mỗi service tự so chuỗi thì lỗi cùng loại dễ lặp lại.

Ngoài ra identity và media khởi động được ở production với các giá trị mẫu dùng cho local.

## Quyết định

### Ai là ai

1. Quản trị nền tảng là token không gắn tenant mang vai trò `platform_admin`. Token gắn tenant mang tên vai trò đó không phải quản trị nền tảng.
2. Quản trị của một tiệm là token gắn tenant của tiệm mang vai trò `admin`. Vai trò `admin` trên token không gắn tenant không có nghĩa gì.
3. Hai phép kiểm này nằm trong `packages/nest-kit`. Service không tự so tên vai trò nền tảng. Guard vai trò của `packages/nest-kit` bỏ vai trò đặt sai phạm vi trước lúc so, nên route đòi quản trị nền tảng không nhận token gắn tenant, và route đòi quản trị tenant không nhận token không gắn tenant.

### Quyền trên media

4. Duyệt nội dung và tạo asset hệ thống chỉ dành cho quản trị nền tảng. Quyền này không cấp được bằng vai trò hay permission do tenant tự đặt.
5. Quản trị nền tảng đọc, đổi và liệt kê được media của mọi tiệm và của người chơi.
6. Trong một tiệm: thành viên đọc được media nội bộ và công khai của tiệm; media riêng tư chỉ người tạo và quản trị của tiệm đọc được; chỉ người tạo và quản trị của tiệm đổi hoặc xoá được.
7. Media không gắn tenant: người chơi chỉ đọc, đổi, liệt kê được media do mình tạo. Mức nội bộ chỉ có nghĩa bên trong một tenant.
8. Media công khai không gắn tenant thì mọi tài khoản đã đăng nhập đọc được, kể cả thành viên đang dùng token của một tiệm. Asset hệ thống dùng đường này.
9. Người chơi tải lên, hoặc chuyển một tệp tạm thành tệp lâu dài, thì mã chủ sở hữu phải là chính tài khoản đó. Thành viên của tiệm và quản trị nền tảng đặt được mã chủ sở hữu theo nghiệp vụ.
10. Media chờ duyệt chỉ người tạo và quản trị nền tảng tải được. Media bị từ chối chỉ quản trị nền tảng tải được. Quản trị của tiệm không vượt được trạng thái duyệt.

11. Gọi lại yêu cầu cấp URL tải lên với cùng khoá chống trùng chỉ được cấp lại URL lúc tệp còn chờ tải. Tệp đã hoàn tất thì bị từ chối, để nội dung đã duyệt không bị ghi đè.

### Giá trị mẫu

12. Identity và media từ chối khởi động ở production nếu khoá, mật khẩu hoặc mật khẩu trong địa chỉ database là giá trị mẫu. `infra/compose` chạy hai service ở chế độ development, là chế độ duy nhất nhận giá trị mẫu.

## Hệ quả

- Phép chặn giá trị mẫu chỉ chạy ở production, và chế độ mặc định lúc không khai là development. Môi trường thật phải đặt `NODE_ENV=production`; quên thì service nhận giá trị mẫu, ghi mã một lần ra log và mở tài liệu API.
- Chủ tiệm không tự duyệt được nội dung của tiệm. Nếu về sau cần tiệm tự duyệt nội dung nội bộ, đó là một mức duyệt mới và cần yêu cầu riêng.
- Người chơi chưa đọc được media công khai của một tiệm, vì tệp của tiệm chỉ mở trong tenant của tiệm. Việc hiển thị biển hiệu hay ảnh của tiệm cho người chơi cần một quyết định riêng; đây là câu hỏi mở.
- Service tiêu thụ media của người chơi gắn tệp với đối tượng nghiệp vụ của mình bằng mã tệp, không dựa vào mã chủ sở hữu do client khai.
- Bộ phát token mẫu của media vẫn cấp token tuỳ ý, nên chỉ dùng ở máy dev.
- Service NestJS mới dùng hai phép kiểm trong `packages/nest-kit` thay vì tự so tên vai trò.
