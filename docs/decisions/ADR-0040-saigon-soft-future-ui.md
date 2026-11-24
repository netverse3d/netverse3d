# ADR-0040: Saigon Soft-Future là ngôn ngữ của giao diện 2D

- Trạng thái: accepted
- Ngày: 2026-11-24
- Xem thêm: [ADR-0014](./ADR-0014-saigon-cyber-and-own-characters.md), [ADR-0016](./ADR-0016-shop-identity-as-data.md), [ADR-0017](./ADR-0017-web-client-layers.md), [ADR-0010](./ADR-0010-one-way-virtual-currency.md), [ADR-0033](./ADR-0033-credit-rate-play-block-and-starter-points.md)

## Bối cảnh

Client game đã tách cảnh 3D, kho trạng thái và giao diện theo ADR-0017, nhưng phần giao diện 2D chưa có nền chung:

- `apps/web-3d/app/globals.css` có 9 biến màu đặt tên theo màu (`--cyan`, `--violet`…), 3 bậc khoảng cách, 2 bậc bo góc, 1 cỡ chữ.
- `packages/ui` mới giữ chỗ.
- HUD, hộp tài khoản, gợi ý ngồi máy cùng hộp xác nhận thuê máy, desktop tối thiểu khi thuê máy (#425), hộp thư thông báo (#427) và nút PWA tự làm nút, hộp thoại, lỗi, trạng thái tải theo cách riêng.
- Gợi ý ngồi máy gửi lệnh mỗi lần bấm, chưa có trạng thái chờ.

Mỗi tiệm có bộ màu riêng (ADR-0016). Nếu màu tiệm đi thẳng vào component thì một bộ màu xấu có thể làm chữ khó đọc hoặc làm màu lỗi trông như màu nhấn.

Người dẫn dắt nhóm đã xem ảnh tham chiếu Style Direction 04 "Saigon Soft-Future" và chốt các điểm dưới đây ngày 2026-11-24.

## Quyết định

**Phạm vi**

- Saigon Soft-Future là ngôn ngữ của giao diện 2D: HUD, hộp thoại, màn tài khoản, gợi ý tương tác, màn tạo nhân vật, màn hình máy, hộp thư, trang quản trị.
- Thế giới và nhân vật 3D không đổi: vẫn theo ADR-0014 và [tiêu chí mỹ thuật](../wiki/product/art-criteria.md).
- Ảnh tham chiếu chỉ định hướng về cảm giác, bảng màu và bố cục. Dựng giống hệt ảnh là không đạt.
- Những thứ trong ảnh trái yêu cầu thì bỏ: đồng tiền thứ hai (kim cương) trái REQ-028, ADR-0010 và ADR-0033. Những thứ chưa có yêu cầu được ghi thành REQ nháp riêng (REQ-053 tới REQ-059), không làm trong hệ thiết kế. Biểu tượng thư trong ảnh ứng với hộp thư thông báo đã có theo REQ-008.

**Cảm giác**

- Thân thiện, hiện đại, mang bản sắc Sài Gòn, không cực đoan cyberpunk. Nhiều chiều sâu nhưng không phô trương.
- Nền panel tối ở mọi nơi, kể cả màn toàn trang. Không dùng nền sáng.
- Phông chính là Be Vietnam Pro. Phông đơn cách chỉ cho số liệu kỹ thuật.

**Token**

- Token là biến CSS trong `packages/ui`, chia ba tầng:

| Tầng       | Ví dụ                                                     | Ai được dùng       |
| ---------- | --------------------------------------------------------- | ------------------ |
| Gốc        | thang màu tím, khoảng cách 4, bo góc lớn                  | Chỉ tầng ngữ nghĩa |
| Ngữ nghĩa  | mặt nền, chữ, viền focus, hành động chính, trạng thái lỗi | Component          |
| Thành phần | nền nút chính, bo góc hộp thoại                           | Chính component đó |

- Component không ghi mã màu, cỡ chữ, khoảng cách, số lớp hay thời lượng; chỉ dùng token ngữ nghĩa hoặc thành phần.
- Màu riêng của tiệm chỉ đổi token accent. Màu trạng thái, chữ và viền focus không đổi theo tiệm.
- Cặp chữ trên mặt nền đạt tương phản 4.5:1; viền focus, viền điều khiển và màu trạng thái đạt 3:1 trên mặt nền. Test đọc chính tệp token để kiểm.
- Thứ tự lớp cố định: canvas, gợi ý trong thế giới, HUD, thông báo nhanh, hộp thoại, lớp khôi phục.

**Kính và chuyển động**

- Kính mờ chỉ dùng cho panel cần cảm giác không gian, và luôn có bản nền đặc. Ở mức chất lượng `low`, hoặc khi hệ điều hành báo người dùng chọn giảm trong suốt (`prefers-reduced-transparency`), giao diện dùng nền đặc. Mức chất lượng đọc từ kho trạng thái theo [wiki client game](../wiki/engineering/web-client.md). Game không thêm cài đặt riêng cho điều này.
- Thời lượng chuyển động lấy từ token: tức thì, nhanh, cơ bản, panel, chuyển cảnh. Khi hệ điều hành báo người dùng chọn giảm chuyển động (`prefers-reduced-motion`), mọi thời lượng về 0.
- Chuyển động không được chặn thao tác hay làm mất focus.

**Hành vi**

- Trạng thái tương tác dùng chung: `idle`, `pending`, `confirmed`, `denied`, `error`.
- Đang `pending` thì component không gửi thêm cùng một lệnh. `confirmed` chỉ đến từ phòng hoặc server. Khoá ở giao diện không thay luật phía server: giữ chỗ máy vẫn theo REQ-018, giao dịch Xèng vẫn theo REQ-028 và ADR-0010.
- Tải không có tiến độ thật thì không hiện phần trăm.
- Mỗi trạng thái phản hồi có một mẫu riêng: skeleton, spinner, thông báo nhanh, banner, lỗi tại chỗ, trạng thái rỗng, lớp khôi phục. Không gộp thành một component tải hay một component lỗi.

**Nơi ghi và nơi xem**

- Quy tắc có mã nằm ở [tiêu chí giao diện](../wiki/product/ui-criteria.md). Cách dùng token và component nằm ở [hệ thiết kế giao diện](../wiki/engineering/design-system.md).
- Mọi token và component có mặt trong Thư viện giao diện, xuất bản cạnh Thư viện 3D. Component chưa có trong thư viện thì chưa được dùng.
- Component dùng chung nằm ở `packages/ui`. Component riêng của game như gợi ý ngồi máy, màn tạo nhân vật nằm ở `apps/web-3d/src/ui/`, component riêng của trang quản trị nằm ở `apps/admin`; cả hai dùng lại component của `packages/ui`, đúng ranh giới ADR-0017.

## Hệ quả

- Đổi bộ màu chỉ sửa tầng gốc; thêm màu tiệm không chạm component.
- `globals.css` của `apps/web-3d` chỉ còn nạp token và đặt lại mặc định. Mọi `.module.css` đổi sang tên ngữ nghĩa trong một lần.
- Thêm component mới tốn thêm một bước: thêm vào Thư viện giao diện với đủ trạng thái.
- Kính mờ trên canvas WebGL tốn GPU và chưa được đo trên máy tối thiểu của ADR-0017. Nếu đo thấy tụt dưới 30 khung hình mỗi giây trong tiệm 50 máy thì nền đặc thành mặc định ở cả mức `medium`.
- Desktop tối thiểu khi thuê máy và hộp thư thông báo chuyển sang component chung ở #418. Màn tạo nhân vật (REQ-003) và phần còn lại của màn hình máy (REQ-032) dùng hệ này ngay khi được làm.

Liên quan: REQ-052, REQ-018, REQ-004, REQ-008, REQ-028, REQ-053, REQ-054, REQ-055, REQ-056, REQ-057, REQ-058, REQ-059.
