# ADR-0043: Icon giao diện lấy từ bộ Phosphor

- Trạng thái: accepted
- Ngày: 2026-11-27
- Xem thêm: [ADR-0041](./ADR-0041-registered-interface-components.md), [ADR-0042](./ADR-0042-radix-headless-behaviour.md), [ADR-0032](./ADR-0032-no-dependabot.md)

## Bối cảnh

Icon của `packages/ui` từng là 22 đường SVG vẽ tay. Nét không đều, hình thô, thêm icon mới phải tự vẽ, và người dẫn dắt không duyệt bộ này. Mọi chỗ dùng icon đã đi qua component `Icon` của `packages/ui`, nên đổi nguồn chỉ chạm một tệp.

Ba bộ được cân nhắc: Phosphor (MIT, sáu độ đậm gồm hai lớp), Lucide (ISC, nét tròn trung tính), Tabler (MIT, nhiều icon nhất). Người dẫn dắt chọn Phosphor vì có nhiều độ đậm hợp phong cách neon.

## Quyết định

1. Icon giao diện 2D lấy từ Phosphor Icons qua gói `@phosphor-icons/react`, dùng bản `dist/ssr` để vẽ được cả lúc dựng tĩnh lẫn trên trình duyệt.
2. Chỉ `packages/ui/react/icon.tsx` import Phosphor. Component và màn hình dùng `Icon` với tên trong bảng của tệp đó; tên là nghĩa trong game (`bell`, `seats`, `lock`), không phải tên của Phosphor.
3. Độ đậm mặc định là `bold`, người dẫn dắt chọn sau khi xem bảng so sánh trong Thư viện giao diện. Component chỉ đổi độ đậm khi có lý do hiển thị riêng.
4. Thêm icon mới là thêm một dòng ánh xạ tên sang icon Phosphor; không vẽ tay đường SVG.
5. Gói cài từ npm, không chép SVG vào repo, nên `packages/ui` giữ `provenance: original`. Nâng phiên bản theo ADR-0032.

## Hệ quả

- Icon cùng một họ hình và độ dày nét trên mọi màn.
- Bản dựng chỉ kèm những icon có trong bảng ánh xạ.
- Test "mọi tên icon đăng ký vẽ ra được hình" bắt lỗi khi Phosphor đổi hoặc bỏ một icon.

Liên quan: REQ-052.
