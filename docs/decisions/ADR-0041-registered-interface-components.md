# ADR-0041: Giao diện chỉ ghép từ component đã đăng ký

- Trạng thái: accepted
- Ngày: 2026-11-25
- Xem thêm: [ADR-0040](./ADR-0040-saigon-soft-future-ui.md), [ADR-0019](./ADR-0019-registered-parts-and-one-render-standard.md), [ADR-0017](./ADR-0017-web-client-layers.md)

## Bối cảnh

Hộp đăng nhập, nút "Đăng nhập" và nút "Cập nhật ứng dụng" từng được dựng thẳng trong mã màn hình: mỗi chỗ một `<button>` và một khối CSS riêng, bo góc trơn, viền mảnh. Token có đúng thì hình vẫn lệch với hướng đã chốt, và mỗi người viết thêm một kiểu nút khác. Người dẫn dắt nhóm đã duyệt bộ component lai Neon Arcade × Saigon Soft-Future ngày 2026-11-25 và yêu cầu cấm component tự chế trong mã giao diện.

Thế giới 3D đã có luật tương tự ở ADR-0019: mọi thứ nhìn thấy là thành phần đã đăng ký, công cụ kiểm đỏ khi cảnh dùng thứ chưa đăng ký.

## Quyết định

1. `packages/ui` là nơi duy nhất tạo component giao diện. Mỗi component có một mục trong `packages/ui/components/registry.json`: tên React, class CSS, tham số và giá trị cho phép, mã tiêu chí, mẫu trong Thư viện giao diện.
2. Test của `packages/ui` đỏ khi:
   - CSS có một khối component chưa đăng ký;
   - một mục đăng ký không có khối CSS, không có mẫu trong thư viện, hoặc có giá trị tham số mà CSS không xử lý;
   - mục đăng ký nhắc một mã tiêu chí không có trên [trang tiêu chí](../wiki/product/ui-criteria.md).
3. Mã ứng dụng (`apps/web-3d`, `apps/admin`) chỉ ghép component đã đăng ký, import từ `@netverse/ui`:
   - JSX chỉ dùng thẻ cấu trúc như `div`, `section`, `p`, `ul`, `canvas`. Nút, ô nhập, hộp chọn, hộp thoại, liên kết, phím phải là component đã đăng ký.
   - `.module.css` của ứng dụng chỉ dàn trang: vị trí, grid, flex, khoảng cách, kích thước, lớp z bằng token. Không đặt nền, viền, bóng, màu, phông, bo góc, `clip-path`, `filter`.
   - Không dùng `style={{…}}` và không tự gắn class `nv-*`.
   - Tham số component có kiểu TypeScript sinh từ sổ đăng ký; truyền giá trị ngoài sổ thì `tsc` báo lỗi.
4. Lệnh `pnpm ui:check` kiểm điểm 3 và chạy trong `pnpm verify`.
5. Cần một component mới thì PR vào `packages/ui` trước: mục đăng ký, CSS, React, mẫu thư viện, test. Màn hình chỉ dùng nó sau khi PR đó vào `staging`.

## Hệ quả

- Mọi màn dùng cùng một bộ nút, ô nhập, panel, thẻ; đổi hình một component là mọi màn đổi theo.
- Viết màn mới chậm hơn khi thiếu component, vì phải qua `packages/ui` trước. Đổi lại không còn component ma.
- Các màn hiện có (HUD, hộp tài khoản, gợi ý ngồi máy, hộp xác nhận thuê, desktop khi thuê máy, hộp thư, nút PWA) phải chuyển sang component đã đăng ký trước khi bật `ui:check`; việc này thuộc #418.
- Thư viện giao diện có bảng sổ đăng ký, là nơi tra component nào đang có trước khi viết mã.

Liên quan: REQ-052.
