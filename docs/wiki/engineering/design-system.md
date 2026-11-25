# Hệ thiết kế giao diện

Giao diện 2D của Netverse 3D dùng ngôn ngữ Saigon Soft-Future theo [ADR-0040](../../decisions/ADR-0040-saigon-soft-future-ui.md) và [REQ-052](../../requirements/registry.yaml). Trang này nói token và component nằm ở đâu, đặt tên thế nào, thêm mới ra sao. Tiêu chí để duyệt một màn hay một component nằm ở [tiêu chí giao diện](../product/ui-criteria.md). Ranh giới giữa cảnh 3D, kho trạng thái và giao diện theo [client game](./web-client.md).

## Đang ở đâu

Hệ thiết kế được dựng theo từng issue con của [#415](https://github.com/netverse3d/netverse3d/issues/415):

| Issue                                                       | Thêm gì                                                                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [#416](https://github.com/netverse3d/netverse3d/issues/416) | REQ-052, ADR-0040, trang này và trang tiêu chí                                                                                                   |
| [#417](https://github.com/netverse3d/netverse3d/issues/417) | Token trong `packages/ui`, Thư viện giao diện với mục Nền tảng                                                                                   |
| [#418](https://github.com/netverse3d/netverse3d/issues/418) | Component dùng chung, mục Component; HUD, hộp tài khoản, gợi ý ngồi máy và hộp xác nhận thuê, desktop khi thuê máy, hộp thư, nút PWA chuyển sang |
| [#419](https://github.com/netverse3d/netverse3d/issues/419) | Trạng thái chờ khi ngồi máy, lớp khôi phục khi mất WebGL, mục Mẫu tương tác                                                                      |

Token và Thư viện giao diện có từ #417. `apps/web-3d` nạp `@netverse/ui/tokens.css` ở `app/layout.tsx`; `globals.css` không còn biến riêng.

## Token

Token là biến CSS trong `packages/ui/tokens/`. Màu, chữ, khoảng cách, bo góc và lớp chia ba tầng; chuyển động nằm riêng ở `motion.css` với các nhịp tức thì, nhanh, cơ bản, panel, chuyển cảnh, mọi component được dùng.

| Tầng       | Tệp             | Đặt tên theo                                                     | Ai được dùng       |
| ---------- | --------------- | ---------------------------------------------------------------- | ------------------ |
| Gốc        | `primitive.css` | Giá trị: thang màu, bậc khoảng cách, bo góc                      | Chỉ tầng ngữ nghĩa |
| Ngữ nghĩa  | `semantic.css`  | Ý nghĩa: mặt nền, chữ, focus, hành động, trạng thái, accent, lớp | Mọi component      |
| Thành phần | cạnh component  | Component và phần của nó                                         | Chính component đó |

Luật dùng:

- Component chỉ đọc token ngữ nghĩa hoặc token thành phần của chính nó. Đọc thẳng token gốc thì đổi bộ màu sẽ không theo.
- Không ghi mã màu, cỡ chữ, khoảng cách, số lớp hay thời lượng trong `.module.css`. Test "component không ghi giá trị trực tiếp và chỉ dùng biến đã khai" của #417 chặn phần này.
- Màu riêng của tiệm chỉ ghi đè token accent. Đừng dùng accent cho lỗi, cảnh báo hay chữ.
- Cần một ý nghĩa chưa có token thì thêm token ngữ nghĩa mới, đưa nó vào Thư viện giao diện, chạy test tương phản; không mượn token có ý nghĩa khác.

Bảng màu đi theo ảnh định hướng ở trang tiêu chí: nền tối ngả tím, tím làm màu nhấn, cùng hồng, xanh da trời nhạt và cam đào. Giá trị cụ thể chỉ nằm trong `primitive.css`; test tương phản quyết định cặp nào dùng được.

## Kính, nền đặc và chuyển động

- Panel kính dùng token mặt nền kính. Gốc trang mang kiểu mặt nền đang dùng, do `app` đặt theo mức chất lượng trong kho trạng thái và tuỳ chọn giảm trong suốt của hệ điều hành (`prefers-reduced-transparency`); ở mức `low` hoặc khi tuỳ chọn đó bật, mọi panel kính thành nền đặc mà component không phải biết. Game không có cài đặt riêng cho việc này.
- Thời lượng lấy từ `motion.css`. Khi hệ điều hành báo giảm chuyển động (`prefers-reduced-motion`), mọi thời lượng về 0.

## Component

- Component dùng chung nằm ở `packages/ui`: nút, hộp thoại, spinner, skeleton, thông báo nhanh, banner, lỗi tại chỗ.
- Component riêng của game nằm ở `apps/web-3d/src/ui/` và dùng lại component của `packages/ui`: gợi ý ngồi máy, desktop khi thuê máy, hộp thư, màn tạo nhân vật. Component riêng của trang quản trị nằm ở `apps/admin` theo cùng luật.
- Component cần phím mũi tên, giữ focus hay định vị lớp nổi (menu, tooltip, ô chọn, tab, công tắc, vùng thông báo) dựng trên primitive Radix headless; hình dáng vẫn do CSS của `packages/ui`. Mã ứng dụng không import `@radix-ui/*` ([ADR-0042](../../decisions/ADR-0042-radix-headless-behaviour.md)).
- Logic trạng thái của component (khi nào tắt, khi nào báo bận, khi nào được đóng) viết thành hàm TypeScript thuần cạnh component để test bằng `node --test`; phần JSX chỉ vẽ theo kết quả của hàm đó.
- Component gửi lệnh thì nhận trạng thái tương tác `idle`, `pending`, `confirmed`, `denied` hoặc `error` từ kho trạng thái. Đang `pending` thì không gửi thêm; `confirmed` chỉ do phòng hoặc server đặt.

Mã màn hình không tự tạo component. Trước khi viết một màn, tra bảng sổ đăng ký trong Thư viện giao diện; component nào chưa có thì thêm vào `packages/ui` trong một PR riêng rồi mới dùng ([ADR-0041](../../decisions/ADR-0041-registered-interface-components.md)).

Thêm một component:

1. Tra sổ đăng ký `packages/ui/components/registry.json` và Thư viện giao diện xem đã có chưa; thường chỉ cần một giá trị tham số mới.
2. Thêm mục vào sổ đăng ký: tên React, class CSS, tham số, mã tiêu chí, mã mẫu thư viện.
3. Viết test cho hàm trạng thái trước, theo tên ca ở cột cách kiểm của tiêu chí liên quan.
4. Viết component, chỉ dùng token.
5. Thêm vào Thư viện giao diện với đủ trạng thái áp dụng. Với component của `packages/ui`, thêm mẫu vào `library/demos.tsx`, test đỏ nếu thiếu; component riêng của game đưa vào mục Mẫu tương tác và người duyệt xem bằng mắt.
6. Đi qua bảng kiểm duyệt component ở [tiêu chí giao diện](../product/ui-criteria.md#bang-kiem-duyet-component), chụp từng trạng thái vào PR.

## Dùng component trong màn hình

- Import từ `@netverse/ui/react`: `Button`, `IconButton`, `Panel`, `Dialog`, `TextField`, `Textarea`, `SearchField`, `Select`, `Switch`, `RadioGroup`, `Text`, `Heading`, `Alert`, `Toast`, `Badge`, `ListItem`… Danh sách đủ là bảng sổ đăng ký trong Thư viện giao diện.
- Tham số có kiểu sinh từ sổ đăng ký (`packages/ui/react/variants.generated.ts`); truyền giá trị ngoài sổ thì `tsc` báo lỗi. Đổi sổ đăng ký thì chạy `pnpm --filter @netverse/ui types`; test của `packages/ui` đỏ nếu quên.
- CSS của component nằm trong `@layer netverse-components`, nên quy tắc dàn trang trong `.module.css` của màn hình luôn thắng mà không cần tăng độ ưu tiên.
- Component nhận `className` để màn hình đặt vị trí, cùng mọi thuộc tính `data-*`, `aria-*`, `role` và sự kiện. Không nhận `style`.
- `.module.css` của màn hình chỉ dàn trang: vị trí, grid, flex, khoảng cách, kích thước, lớp z bằng token `--ui-layer-*`.
- `pnpm ui:check` chạy trong `pnpm verify` và báo đỏ khi màn hình dùng thẻ không phải thẻ cấu trúc (`<button>`, `<input>`, `<dialog>`…), dùng `style` nội tuyến, tự gắn class `nv-*`, import component chưa đăng ký, hoặc đặt thuộc tính hình ảnh trong CSS.
- Hộp xác nhận cần cho người chơi vẫn đi lại trong thế giới (ví dụ xác nhận thuê máy) dùng `Overlay` cùng `Panel` có `role="dialog"`, không dùng `Dialog` vì `Dialog` chặn phím của game.

## Thư viện giao diện

Thư viện giao diện là trang tĩnh vẽ bằng chính token và component React của `packages/ui`, gói bằng esbuild, xuất bản tại [netverse3d.github.io/netverse3d/ui](https://netverse3d.github.io/netverse3d/ui/), cạnh [Thư viện 3D](https://netverse3d.github.io/netverse3d/game-assets/library/), mỗi khi `staging` đổi. Xem tại máy bằng `pnpm ui:library` rồi mở `http://localhost:4174/ui/`. Màu nhấn đọc từ chính công thức tiệm của `game-assets`. Thư viện gồm ba mục:

- **Nền tảng:** mẫu màu kèm tên token, bảng tương phản tính trực tiếp, thang chữ, khoảng cách, bo góc, thứ tự lớp, chuyển động; đổi thử màu tiệm, mức chất lượng, giảm trong suốt, giảm chuyển động.
- **Component:** mỗi component một bảng biến thể nhân trạng thái.
- **Mẫu tương tác:** vòng gợi ý ngồi máy qua các bước chờ, từ chối, lỗi; lớp khôi phục khi mất WebGL.

Mỗi component đăng ký có một mẫu React trong `packages/ui/library/demos.tsx`, gọi đúng component mà game dùng; test của `packages/ui` dựng từng mẫu và đỏ khi thiếu mẫu hoặc mẫu không ra class của component. Thư viện chỉ để xem. Game thật vẫn viết trong `apps/web-3d`.
