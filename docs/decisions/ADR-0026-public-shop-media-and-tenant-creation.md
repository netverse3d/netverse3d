# ADR-0026: Tệp công khai của tiệm mở cho mọi tài khoản, và service shop tạo tenant lúc mở tiệm

- Trạng thái: accepted
- Ngày: 2026-11-13
- Xem thêm: [ADR-0024](./ADR-0024-identity-origin-and-shop-tenants.md), [ADR-0025](./ADR-0025-media-access-by-tenant-model.md)

## Bối cảnh

Sau [ADR-0025](./ADR-0025-media-access-by-tenant-model.md) còn hai câu hỏi mở.

Thứ nhất, tệp của một tiệm chỉ mở trong tenant của tiệm, kể cả tệp tiệm đặt ở mức công khai. Người chơi dùng token không gắn tenant nên không xem được ảnh hay biển hiệu tiệm tải lên. Trong lúc đó tệp công khai không gắn tenant thì ai đã đăng nhập cũng đọc được, nên mức công khai mang hai nghĩa khác nhau tuỳ tệp thuộc ai.

Thứ hai, identity chỉ cho quản trị nền tảng tạo tenant. [REQ-009](../requirements/registry.yaml) ghi muốn mở tiệm thì phải thuê đất trước, và việc thuê đất thuộc service `shop`, hiện chưa có mã. Cần quyết ai tạo tenant lúc một tiệm được mở, để identity và shop không tự chọn hai hướng khác nhau.

## Quyết định

### Tệp công khai của tiệm

1. Tệp ở mức công khai thì mọi tài khoản đã đăng nhập đọc và tải được, dù tệp thuộc tiệm nào hay không gắn tenant. Điểm này thay điểm 8 của ADR-0025.
2. Tệp ở mức riêng tư và nội bộ của tiệm vẫn chỉ mở trong tenant của tiệm. Cách ly giữa các tiệm áp cho hai mức này.
3. Chỉ người tạo, quản trị của tiệm và quản trị nền tảng đổi hoặc xoá được tệp của tiệm, kể cả tệp công khai.
4. Trạng thái duyệt vẫn đứng trên mức công khai: tệp chờ duyệt hoặc bị từ chối thì người ngoài không tải được.
5. Danh sách tệp không đổi: người ngoài không liệt kê được tệp của một tiệm. Muốn hiện tệp công khai của tiệm cho người chơi thì service nắm nghiệp vụ đưa mã tệp, client xin đọc theo mã.
6. Tệp công khai vẫn đi qua URL ký sẵn có thời hạn. Phân phối qua địa chỉ đọc thẳng hay CDN làm sau, như REQ-006 đã ghi.

### Ai tạo tenant

7. Service `shop` tạo tenant và gán chủ tiệm sau lúc việc thuê đất hoàn tất. Người dùng không tự tạo tenant, để không có tenant nào tồn tại mà chưa có đất.
8. Shop gọi identity bằng định danh riêng của service, không dùng token của người dùng và không mượn quyền quản trị nền tảng. Identity cấp cho định danh đó đúng một quyền: tạo tenant kèm chủ tiệm.
9. Phần này được cài lúc dựng service shop, cùng với bên gọi của nó. Trước lúc đó quản trị nền tảng tạo tenant bằng tay.

## Hệ quả

- REQ-006 được sửa câu chữ: tiệm này không đọc được tệp không công khai của tiệm khác.
- Tiệm đặt một tệp ở mức công khai là chấp nhận mọi tài khoản xem được. Giao diện tải lên của tiệm cần nói rõ điều này.
- Lúc chế độ duyệt trước tắt, tệp công khai của tiệm hiện ngay cho mọi người. Bật `MEDIA_USER_CONTENT_REQUIRES_REVIEW` nếu cần duyệt trước.
- Identity chưa có định danh cho service. Lúc dựng shop phải thêm phần này và test đầu cuối cho nó; đó là việc của issue dựng shop.
- Câu hỏi mở 25 và 26 được đóng bằng ADR này.
