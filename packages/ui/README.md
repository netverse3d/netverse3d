# ui

Token và công cụ giao diện dùng chung của Netverse 3D theo [ADR-0040](../../docs/decisions/ADR-0040-saigon-soft-future-ui.md). Cách dùng ở [hệ thiết kế giao diện](../../docs/wiki/engineering/design-system.md), tiêu chí ở [tiêu chí giao diện](../../docs/wiki/product/ui-criteria.md).

- `tokens/`: biến CSS ba tầng (`primitive.css`, `semantic.css`) và chuyển động (`motion.css`). Ứng dụng nạp `@netverse/ui/tokens.css`.
- `src/contrast.mjs`: tỉ lệ tương phản WCAG, nền trong suốt tính ở trường hợp xấu nhất trên nền đen và nền trắng.
- `src/accent.mjs`: làm sáng màu nhấn của tiệm tới khi đạt 3:1 trên mặt nền.
- `src/keys.mjs` (`@netverse/ui/keys`): phím đang thuộc về ô nhập hay ô chọn nào. Game dùng để không cho nhân vật đi khi người chơi đang gõ hay chọn; các hộp nghe phím trên `window` dùng để không nhận nhầm Enter, Esc của ô chọn đang mở.
- `src/tokens.mjs`, `src/catalog.mjs`: đọc khai báo token và danh mục nhóm token cho test và thư viện.
- `react/`: component React đã đăng ký, import từ `@netverse/ui/react`. Hành vi lớp nổi dựng trên Radix headless theo [ADR-0042](../../docs/decisions/ADR-0042-radix-headless-behaviour.md).
- `library/`: Thư viện giao diện vẽ bằng component React thật, gói bằng esbuild; `demos.tsx` giữ mẫu của từng component đăng ký. Xem tại máy bằng `pnpm ui:library`.

Test: `pnpm --filter @netverse/ui test`. Kiểm kiểu: `pnpm --filter @netverse/ui lint`.
