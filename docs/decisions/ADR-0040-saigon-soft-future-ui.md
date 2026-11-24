# ADR-0040: Giao diện 2D dùng hệ thiết kế Saigon Soft-Future

- Trạng thái: accepted
- Ngày: 2026-11-24
- Xem thêm: [ADR-0017](./ADR-0017-web-client-layers.md), [ADR-0016](./ADR-0016-shop-identity-as-data.md)

## Bối cảnh

HUD, hộp tài khoản và các nút trong trò chơi đang có cách đặt màu và phản hồi riêng. Khi thêm màn mới, sự khác biệt dễ tăng và trạng thái chờ có thể gửi trùng thao tác. Người dẫn dắt chốt hướng Style Direction 04 tại [#415](https://github.com/netverse3d/netverse3d/issues/415) để các màn 2D dùng cùng một hệ thiết kế.

## Quyết định

- Dùng Saigon Soft-Future và nền panel tối cho các màn 2D. Cảnh và nhân vật 3D tiếp tục theo [ADR-0014](./ADR-0014-saigon-cyber-and-own-characters.md) và tiêu chí mỹ thuật thành phố.
- Token CSS có ba tầng. Token gốc cung cấp giá trị. Token ngữ nghĩa đặt tên cho mặt nền, chữ, đường biên, hành động, trạng thái và focus. Token thành phần nối thuộc tính của một component vào tầng ngữ nghĩa.
- Màu riêng của tiệm tác động qua accent. Màu trạng thái, lỗi và focus dùng giá trị chung của hệ thiết kế.
- Be Vietnam Pro là phông chính. Thời lượng chuyển động lấy từ token. Khi bật giảm chuyển động, các thời lượng về 0. Panel kính luôn có nền đặc tương ứng, dùng ở mức chất lượng `low` hoặc khi người dùng chọn giảm trong suốt.
- Trạng thái tương tác dùng `idle`, `pending`, `confirmed`, `denied` và `error`. `pending` khoá gửi lặp. `confirmed` chỉ đặt khi phòng hoặc máy chủ xác nhận. `denied` dùng cho từ chối từ nguồn có thẩm quyền, còn `error` dùng cho lỗi kỹ thuật.
- Tham chiếu hình ảnh định hướng không khí, màu và bố cục. Nhóm thiết kế giao diện riêng. Chi tiết đồng kim cương bị loại theo REQ-028 và [ADR-0033](./ADR-0033-credit-rate-play-block-and-starter-points.md). Năm ý tưởng REQ-053 đến REQ-057 giữ ở mức đề xuất.

## Hệ quả

- Các thành phần 2D và mẫu tương tác được xem và kiểm ở cùng một nơi. [Tiêu chí giao diện](../wiki/product/ui-criteria.md) là nguồn kiểm duyệt cho mỗi thay đổi.
- `packages/ui` giữ token, component và thư viện. App vẫn ghép UI với trạng thái theo ADR-0017. Quyết định nghiệp vụ và trạng thái xác nhận tiếp tục thuộc phòng hoặc dịch vụ tương ứng.
- Mức chất lượng và tuỳ chọn trợ năng đổi cách thể hiện của UI, còn luồng thao tác và thông tin phản hồi giữ nhất quán.
