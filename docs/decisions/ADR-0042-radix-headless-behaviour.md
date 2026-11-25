# ADR-0042: Hành vi component giao diện dùng Radix headless

- Trạng thái: accepted
- Ngày: 2026-11-25
- Xem thêm: [ADR-0041](./ADR-0041-registered-interface-components.md), [ADR-0040](./ADR-0040-saigon-soft-future-ui.md), [ADR-0032](./ADR-0032-no-dependabot.md)

## Bối cảnh

Bộ component đầu tiên của `packages/ui` chỉ có những thứ hành vi đơn giản: nút, ô nhập, panel, hộp thoại dùng `<dialog>` gốc. Bộ cơ bản tiếp theo (#443) cần menu thả xuống, tooltip, popover, ô chọn tuỳ biến, tab, công tắc, nhóm lựa chọn, vùng thông báo. Với mỗi thứ đó, phần khó không phải hình dáng mà là hành vi: phím mũi tên, Home, End, gõ chữ để nhảy mục, Esc đóng, giữ và trả focus, vai trò ARIA, định vị lớp nổi khi gần mép màn hình, bỏ qua cuộn của trang phía dưới. Tự viết lại từng thứ tốn nhiều công và dễ sai trên trình đọc màn hình.

Radix UI Primitives là bộ component React không kèm kiểu (headless), giấy phép MIT, hỗ trợ React 19, chia thành từng gói nhỏ `@radix-ui/react-*`. Hình dáng hoàn toàn do CSS của mình quyết định.

## Quyết định

1. Component nào cần hành vi bàn phím, focus hay định vị lớp nổi thì dựng trên primitive Radix tương ứng, ví dụ Dropdown Menu, Tooltip, Popover, Select, Tabs, Switch, Radio Group, Toggle Group, Toast, Progress, Separator. Component chỉ hiển thị thì không cần Radix.
2. Radix chỉ là phụ thuộc của `packages/ui`. Mã ứng dụng không import `@radix-ui/*` mà dùng component đã đăng ký từ `@netverse/ui/react`, theo ADR-0041.
3. Hình dáng vẫn do lớp component neon của `packages/ui` quyết định: class `nv-*`, tham số `data-*` trong sổ đăng ký, token. Không dùng theme hay CSS có sẵn của Radix.
4. Mỗi primitive là một gói riêng, chỉ thêm khi có component đăng ký dùng tới. Radix được cài từ npm, không chép mã vào repo, nên `packages/ui` giữ `provenance: original`.
5. Nâng phiên bản Radix theo ADR-0032: có issue, nhánh `chore/`, đi qua bộ kiểm đầy đủ.
6. Hành vi do Radix đảm nhận thì không test lại. Test của mình phủ phần mình viết: ánh xạ tham số, sổ đăng ký, logic thuần như hàng đợi thông báo, và smoke trên màn đã dùng component.

## Hệ quả

- Menu, tab, ô chọn dùng được bằng phím và trình đọc màn hình mà không phải tự viết logic focus.
- Thư viện giao diện phải chạy component React thật mới trình diễn được lớp nổi, nên thư viện chuyển sang vẽ bằng React.
- Bản dựng của game thêm vài gói nhỏ. Chỉ primitive được dùng mới vào bản dựng.
- Radix đổi hành vi giữa các bản thì smoke và thư viện là nơi phát hiện, vì không có test riêng cho hành vi đó.

Liên quan: REQ-052.
