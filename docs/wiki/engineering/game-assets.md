# Tài sản 3D

Nhân vật và đồ vật nằm ở `packages/game-assets`. Lý do chọn cách làm này ở [ADR-0015](../../decisions/ADR-0015-blender-sources-as-master.md).

## Xem những gì đã có

[Thư viện 3D](https://netverse3d.github.io/netverse3d/game-assets/library/) cho xem nhân vật với 24 hành động, 12 biểu cảm, bản có và không phụ kiện, con hẻm Sài Gòn, bộ sưu tập các hướng đã thử và tiệm mẫu. Xem tại máy bằng `pnpm assets:library`, rồi mở `http://localhost:4173/library/`. Máy cần có mạng vì trang tải three.js và phông chữ từ CDN.

Tab Hành động dùng đúng mô hình trong `exported/`, nên xuất xong tải lại trang là thấy. Các tab khác là bản phác để chốt hướng, gồm hình khối dựng bằng mã và hai mô hình thử nghiệm trong `library/models/`, chưa phải tài sản chính thức. Thư viện chỉ để xem; game thật sẽ viết trong `apps/web-3d`.

## Bốn nguyên tắc

1. Tệp `.blend` trong `source/` là bản gốc. Mọi sửa đổi làm trong Blender.
2. Không sửa tay `exported/`. Chỉ lệnh xuất mới ghi vào đó.
3. Mỗi tệp `.blend` chỉ một người sửa tại một thời điểm, vì không gộp được như mã.
4. `assets.config.json` là hợp đồng giữa người làm 3D và người viết mã.

## Tệp gốc

| Tệp                     | Chứa                                                                                                               | Mở khi cần                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `character-base.blend`  | Bộ xương `rig`, thân `body`                                                                                        | Sửa dáng người, áo, quần, giày, mặt |
| `clips.blend`           | 36 clip chuyển động                                                                                                | Sửa hoặc thêm chuyển động           |
| `hair-default.blend`    | Tóc `hair`                                                                                                         | Nặn lại tóc                         |
| `accessories.blend`     | `glasses`, `headset`, `backpack`, `cup`, `crate`                                                                   | Sửa phụ kiện và đồ cầm tay          |
| `props-station.blend`   | Bàn máy liền khối `station`, bản cũ còn dùng cho thư viện                                                          | Không sửa nữa, sẽ thay bằng bộ ô đồ |
| `parts-station.blend`   | Mười ô đồ của bàn máy: `desk`, `monitor`, `keyboard`, `mouse`, `mat`, `headset`, `mic`, `speaker`, `chair`, `case` | Sửa một món hoặc thêm biến thể      |
| `environment-kit.blend` | Module phòng: `floor`, `wall`, `corner`, `door`, `window`, `ceiling`, `light`, `marker`                            | Sửa hoặc thêm module phòng          |

Đối tượng tên `guide_...` là khung dây để canh khoảng cách. Chúng không được xuất ra.

## Bộ ô đồ và bộ màu

Để mỗi tiệm có bản sắc riêng (REQ-040), bàn máy và phòng không còn là một khối. Chúng ghép từ các món rời khai trong `kits` của `assets.config.json`, và mọi món đổi màu qua một bộ màu chung thay vì mang màu riêng.

### Ô đồ và biến thể

Mỗi `kit` có một tệp gốc, một tệp xuất và danh sách ô đồ `slots`. Mỗi ô khai `variants`, `maxTriangles`, `size`, và tuỳ chọn `anchors`, `grid`. Đối tượng trong Blender đặt tên `<ô>_<biến thể>`, ví dụ `chair_a`. Thêm biến thể `b` là thêm đối tượng `chair_b` và thêm `"b"` vào `variants`. Mọi biến thể của một ô phải nằm gọn trong `size` (rộng, cao, sâu, tính bằng mét) để đổi món không làm vỡ bố cục.

Gốc đối tượng nằm dưới chân món, giữa mặt đáy. Người chơi ngồi ở phía +Y của bàn và nhìn về −Y; ghế quay mặt về −Y. Apply mọi transform trước khi xuất, đối tượng còn transform sẽ bị lệnh xuất từ chối.

### Điểm neo

Điểm neo là Empty gắn làm con của món, tên `<món>__<neo>` với hai gạch dưới. Vị trí của Empty là điểm neo; với hộp va chạm, scale của Empty là nửa kích thước hộp.

| Neo              | Dùng cho                                                 |
| ---------------- | -------------------------------------------------------- |
| `socket_<ô>`     | Chỗ đặt gốc của món khác, ví dụ `desk_a__socket_monitor` |
| `interact_point` | Chỗ người chơi đứng để bấm tương tác                     |
| `seat_anchor`    | Chỗ đặt hông nhân vật khi ngồi                           |
| `collision_*`    | Hộp va chạm, một món có thể mang nhiều hộp               |

Neo đã khai trong `anchors` của ô mà thiếu trong tệp thì lệnh xuất báo lỗi.

### Bộ màu

Vật liệu chỉ có bốn tên: `surface`, `glow`, `display`, `decal`. Hai vật liệu đầu không mang màu. Mỗi mặt chọn màu bằng toạ độ UV trỏ vào một hàng của ảnh bộ màu 12 hàng, do game tạo lúc chạy từ bộ màu của tiệm:

| Hàng | Vật liệu  | Tên hàng                                                           |
| ---- | --------- | ------------------------------------------------------------------ |
| 0–7  | `surface` | `body`, `metal`, `soft`, `top`, `floor`, `wall`, `ceiling`, `trim` |
| 8–11 | `glow`    | `strip`, `keycap`, `screen`, `accent`                              |

V của UV phải nằm đúng giữa hàng. U chạy từ 0 đến 1 dọc theo dải màu của hàng, nên một hàng có thể là một màu hoặc một dải chuyển màu; bàn phím nhiều màu chỉ cần đặt U khác nhau cho từng phím. `display` và `decal` là vật liệu ảnh cho màn hình và logo, dùng UV tự do trong 0..1. Vật liệu tên khác, UV lệch hàng hoặc ra ngoài 0..1 đều bị lệnh xuất từ chối.

### Module phòng

Phòng ghép từ module trên lưới ô 2 m, tường cao 3 m. Gốc module ở tâm ô, trên sàn. Tường nằm dọc cạnh −Y của ô và quay mặt vào trong. Ô khai `grid` phải có kích thước là bội số của ô lưới trên các trục đã khai (trục của glTF: 0 là ngang, 2 là sâu), nếu không lệnh xuất báo lỗi. Tường, góc, cửa, cửa sổ mang hộp `collision_*`.

### Công thức tiệm

Mỗi tiệm là một tệp JSON trong `recipes/`, theo hợp đồng `packages/contracts/world/shop-look.v1.schema.json`: `palette` (mỗi hàng màu là một dải gồm một hay nhiều màu), `emissive` (dải phát sáng nhẹ cho hàng bề mặt, tuỳ chọn), `variants` (biến thể cho từng ô đồ), `layout` (kích thước phòng theo ô 2 m, vị trí và hướng từng máy, cửa, cửa sổ), `sign` và `lighting`. Ba tiệm mẫu khác nhau về màu, bố cục, biển và đèn: `tim-neon`, `bien-sau`, `cam-retro`; biến thể của chúng đều là `a` vì mỗi ô mới có một biến thể.

Quy ước toạ độ trong `layout`: `cells` là `[rộng, sâu]` tính bằng ô 2 m; ô `[x, z]` có x đếm từ tường `west` (0) sang `east`, z đếm từ tường `north` (0) xuống `south`; `facing` là hướng người ngồi nhìn, màn hình nằm ở phía đó của ô; `at` của cửa và cửa sổ là chỉ số ô dọc theo tường. Mỗi tiệm có đúng một cửa và ô sàn ngay trong cửa phải để trống. `pnpm assets:check` từ chối công thức trỏ tới biến thể không có, thiếu hay thừa hàng màu, dải phát sáng cho hàng không phải bề mặt, đặt máy ngoài phòng, hai máy chung một ô, máy chắn trước cửa, cửa và cửa sổ trùng chỗ, tệp không phải JSON, hoặc tên tệp khác `id`.

## Chuẩn bị

Cần Git LFS và Blender 5.2 trở lên. `pnpm bootstrap` đã bật Git LFS và tải sẵn các tệp. Blender nằm ở vị trí lạ thì đặt biến `BLENDER_PATH`.

## Sửa một tài sản

```
git lfs lock packages/game-assets/source/hair-default.blend
```

1. Tách nhánh từ `staging` theo issue, rồi khoá tệp như trên. Tệp đang bị người khác khoá thì chờ hoặc trao đổi với họ.
2. Mở tệp, sửa, lưu. Giữ nguyên tên đối tượng và tên xương. Apply mọi modifier trừ Armature, vì lệnh xuất từ chối modifier chưa apply.
3. Chạy `pnpm assets:export`. Lệnh ghép các tệp gốc, xuất `.glb`, tạo bản nhẹ rồi tự kiểm.
4. Chạy `pnpm assets:library` và xem động tác đã sửa để nhìn tận mắt.
5. Commit cả tệp `.blend`, tệp `.glb` và `export-stamp.json` rồi mở PR như mọi việc khác.
6. PR merge xong thì mở khoá: `git lfs unlock <tệp>`.

## Hai người cùng làm

Mỗi người khoá một tệp `.blend` khác nhau, nhưng tệp `.glb` và `export-stamp.json` là kết quả chung nên vẫn xung đột khi PR thứ hai cập nhật từ `staging`. Khi đó không gộp tay. Giữ tệp `.blend` của cả hai bên, lấy tạm phiên bản bất kỳ của `exported/`, rồi chạy lại `pnpm assets:export` và commit.

Vật liệu dùng chung, như `logo_canvas`, có bản sao trong nhiều tệp gốc. Đổi vật liệu thì đổi ở mọi tệp có nó, nếu không lệnh xuất sẽ báo lỗi.

## Việc thường gặp

| Việc           | Cách làm                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Chỉnh một clip | Mở `clips.blend`, chọn Action trong Action Editor, sửa keyframe                                                  |
| Thêm clip      | Tạo Action mới, bật Fake User để không bị mất khi lưu, thêm tên vào `clips` trong cấu hình                       |
| Nặn lại tóc    | Sửa đối tượng `hair`, giữ nhóm đỉnh `head` và lớp màu `Col`                                                      |
| Thêm đồ vật    | Tạo `props-<tên>.blend` có một đối tượng, khai vào `props` trong cấu hình                                        |
| Thêm biến thể  | Nhân đôi `<ô>_a` thành `<ô>_b` trong tệp kit, sửa hình trong `size`, gắn lại điểm neo, thêm `"b"` vào `variants` |
| Thêm module    | Dựng trên lưới 2 m trong `environment-kit.blend`, khai ô mới trong `kits` kèm `grid` và `collision_*`            |
| Đổi tên xương  | Không đổi. Mọi clip và mọi món đồ đều bám vào tên xương. Cần đổi thì hỏi người chính về 3D và ghi ADR            |

## Ngân sách

Giới hạn tam giác từng món nằm trong `assets.config.json`. Bản nhẹ dùng khi cảnh đông người, tự giảm thân và tóc còn tổng khoảng 10.000 tam giác. Bộ bàn máy mười món hiện 11.706 tam giác, bộ module phòng 3.804. Muốn tăng ngân sách thì nêu lý do trong PR, và kiểm lại FPS trên GPU thật.

## Bộ kiểm chặn gì

| Lỗi                                                   | Chặn ở            |
| ----------------------------------------------------- | ----------------- |
| Sửa `.blend` mà quên xuất lại                         | `pnpm verify`, CI |
| Sửa `.glb` ngoài lệnh xuất                            | `pnpm verify`, CI |
| Thêm tệp hoặc khai tệp mà chưa xuất                   | `pnpm verify`, CI |
| Tệp không lưu bằng Git LFS                            | CI                |
| Máy chưa có Git LFS                                   | Hook khi push     |
| Sai xương, thiếu clip, vượt ngân sách                 | Lệnh xuất         |
| Mesh chưa gắn xương, thiếu lớp màu bắt buộc           | Lệnh xuất         |
| Modifier chưa apply, vật liệu khác nhau giữa các tệp  | Lệnh xuất         |
| Transform chưa apply, thiếu điểm neo                  | Lệnh xuất         |
| Vật liệu ngoài bộ màu, UV lệch hàng hoặc ra ngoài ảnh | Lệnh xuất         |
| Món to hơn ô, module lệch lưới hoặc lệch tâm ô        | Lệnh xuất         |

Lệnh xuất chỉ ghi `export-stamp.json` khi mọi kiểm đều qua. Xuất lỗi thì `pnpm verify` đỏ cho tới khi sửa xong. Workflow `assets` kiểm lại nội dung thật trên PR, hiện chưa phải check bắt buộc.

Bộ kiểm chỉ thấy cấu trúc. Clip sai dáng hay tóc xấu vẫn cần người nhìn.

## Ai làm được gì

| Mức                  | Cần biết              | Làm được                                      |
| -------------------- | --------------------- | --------------------------------------------- |
| Không dùng Blender   | Web, dữ liệu          | Ghép vào game, đổi màu, thêm món vào danh mục |
| Cơ bản, học vài buổi | Di chuyển, chỉnh khớp | Chỉnh clip, làm đồ vật, biến thể đồ mặc       |
| Người chính          | Rig, sculpt           | Giữ bộ xương, nặn tóc, duyệt chất lượng       |

## Hiện trạng

- Áo, quần, giày còn chung mesh `body`. Tách thành ô đồ là việc của M1.
- Dòng bot và con hẻm chưa làm bằng Blender.
- Mỗi ô đồ mới có một biến thể `a`. Chuột còn thô hơn bảng thiết kế.
- Thư viện vẫn hiển thị bàn máy liền khối. Bộ ô đồ vào thư viện khi có phòng thử.
- Bộ màu lúc chạy và việc ghép món theo điểm neo chưa viết trong `apps/web-3d`.
- Chưa đo FPS trên GPU thật.
- `apps/web-3d` chưa dùng các tệp này. Khi dùng, bước build cần tải Git LFS.
