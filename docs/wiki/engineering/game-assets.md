# Tài sản 3D

Nhân vật và đồ vật nằm ở `packages/game-assets`. Lý do chọn cách làm này ở [ADR-0015](../../decisions/ADR-0015-blender-sources-as-master.md).

## Xem những gì đã có

[Thư viện 3D](https://netverse3d.github.io/netverse3d/game-assets/library/) cho xem nhân vật với 24 hành động, 12 biểu cảm, bản có và không phụ kiện, con hẻm Sài Gòn, bộ sưu tập các hướng đã thử và tiệm mẫu. Xem tại máy bằng `pnpm assets:library`, rồi mở `http://localhost:4173/library/`. Máy cần có mạng vì trang tải three.js và phông chữ từ CDN.

Thư viện mở ra ở trang Tổng quan, chia mục theo loại tài sản: Nhân vật, Món đồ, Phòng, Tiệm mẫu, Soi lỗi và Lưu trữ. Thanh mục, bộ màu, kiểu chữ, thẻ và nút dùng chung nằm ở `library/shared/`; danh sách mục khai trong `library/shared/sections.json`, chữ trên khung nằm ở `library/shared/text.json`. Mỗi mục mang một nhãn: đã dựng lại theo khung mới, còn mở trang cũ, hoặc sắp có. Mục còn trang cũ khai các trang con của nó trong `pages` và được mở bên trong khung qua `library/view.html?section=<mục>&page=<số>`, nên thanh mục không bao giờ biến mất; trang cũ vẫn mở riêng được bằng đường dẫn gốc của nó.

Mục Món đồ là mục đầu tiên đã dựng lại: `library/parts.html` vẽ mọi món của bộ bàn máy và bộ góc console từ `assets.config.json`, cho đổi bộ màu tiệm, bộ màu phím và LED, lọc theo bộ, tìm theo tên, và so số tam giác của từng món với mức trần của ô. Mục đã dựng lại khai trang mới ở `href`; các trang cũ còn cần của nó vẫn nằm trong `pages` và hiện thành dãy thẻ cạnh trang mới. Tham số riêng của trang cũ đi kèm địa chỉ khung, ví dụ `view.html?section=parts&part=mic_b&spin=0` mở đúng món đó trong trang soi.

Trang cũ nhiều tab giờ là `library/studio.html`. Tab Hành động của nó dùng đúng mô hình trong `exported/`, nên xuất xong tải lại trang là thấy. Các tab phố Sài Gòn, bộ sưu tập, xưởng và tiệm là bản phác để chốt hướng, gồm hình khối dựng bằng mã và hai mô hình thử nghiệm trong `library/models/`, chưa phải tài sản chính thức, và được xếp vào mục Lưu trữ. Thư viện chỉ để xem; game thật viết trong `apps/web-3d`.

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

Có hai loại tệp gốc (ADR-0018). Nhân vật, clip, tóc, phụ kiện và `props-station.blend` dựng tay trong Blender nên `.blend` là gốc. Bộ ô đồ bàn máy, module phòng và cảnh tiệm giới thiệu sinh từ script Python chạy trong Blender, nằm ở `packages/game-assets/pipeline/`; với chúng, script là gốc, còn `.blend` là kết quả trung gian được commit để lệnh xuất và Git LFS làm việc như cũ, không sửa tay. Tệp nào sinh từ script thì khai `generator` ngay cạnh `source` trong `assets.config.json`; tệp không có `generator` là dựng tay.

| Tệp gốc                   | Script                          | Thư viện dùng chung                                                                                                 |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `parts-station.blend`     | `pipeline/make_station_hero.py` | `hero_kit.py` (HeroPart, loft, cage, bake), `hero_station.py`, `hero_desks.py`, `hero_chair.py`, `hero_mic_boom.py` |
| `environment-kit.blend`   | `pipeline/make_room_kit.py`     | `hero_kit.py`                                                                                                       |
| `showcase-tim-neon.blend` | `pipeline/make_showcase.py`     | `pipeline/showcase_plan.mjs` sinh `showcase-plan.json` từ công thức và điểm neo của hai bộ đã xuất                  |

`pnpm assets:generate` chạy mọi generator theo thứ tự trong config; thêm tên tệp gốc để chạy một cái, ví dụ `pnpm assets:generate environment-kit`. Lệnh ghi `.blend` vào `source/`, sau đó vẫn phải `pnpm assets:export`. Script trong `pipeline/` không được chứa đường dẫn tuyệt đối tới máy ai (có test chặn), không mang ảnh hay mô hình tham chiếu của bên khác vào repo, và theo cùng luật không chú thích như mã khác. `pipeline/render_part.py` render một món từ tệp `.blend` ra bốn góc để nghiệm thu ngoài trình duyệt.

Thêm cờ `--preview` để bỏ bước nướng AO khi đang tìm dáng một món: `pnpm assets:generate parts-lounge --preview` chỉ dựng hình khối trong vài giây, ảnh bóng là ảnh trắng mang hậu tố `-preview`. Xuất xong vẫn xem được trong lab và trang Món đồ, nút AO bị khoá và ghi là bản xem thử. Bộ kiểm trong repo từ chối tệp xuất mang ảnh xem thử, nên trước khi commit phải sinh lại không có cờ rồi xuất lại. Cờ chỉ tác dụng với các bộ nướng từng món (`station-parts`, `lounge-parts`); tiệm giới thiệu vẫn nướng như cũ.

Đang tìm dáng một món thì phác trước trong Blender đang mở qua MCP rồi mới viết thành script: xem [runbook phác hình](../../runbooks/blender-mcp-sketch.md), lệnh `pnpm assets:sketch <tệp.py> [ảnh.png]`.

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

Vật liệu có năm tên: `surface`, `glow`, `display`, `decal`, `legend`. Hai vật liệu đầu không mang màu. Mỗi mặt chọn màu bằng toạ độ UV trỏ vào một hàng của ảnh bộ màu 12 hàng, do game tạo lúc chạy từ bộ màu của tiệm:

| Hàng | Vật liệu  | Tên hàng                                                           |
| ---- | --------- | ------------------------------------------------------------------ |
| 0–7  | `surface` | `body`, `metal`, `soft`, `top`, `floor`, `wall`, `ceiling`, `trim` |
| 8–11 | `glow`    | `strip`, `keycap`, `screen`, `accent`                              |

V của UV phải nằm đúng giữa hàng. U chạy từ 0 đến 1 dọc theo dải màu của hàng, nên một hàng có thể là một màu hoặc một dải chuyển màu; bàn phím nhiều màu chỉ cần đặt U khác nhau cho từng phím. `display` và `decal` là vật liệu ảnh cho màn hình và logo, dùng UV tự do trong 0..1. Vật liệu tên khác, UV lệch hàng hoặc ra ngoài 0..1 đều bị lệnh xuất từ chối.

### Bàn phím

Sáu biến thể bàn phím đều là bố cục chuẩn (năm ANSI Mỹ và một bố cục Apple compact, biến thể `f`, phím chiclet thấp trên vỏ nhôm mỏng, hợp với bộ màu `mac`), sinh từ dữ liệu chứ không vẽ tay: `tools/keyboards.mjs` mô tả từng hàng phím (nhãn, bề rộng theo đơn vị 19,05 mm, mã `KeyboardEvent.code`, ký tự khi giữ Shift, vùng màu) và ghi ra `keyboards.json`; test giữ tệp JSON khớp với bộ sinh, kiểm số phím (60% có 61, TKL 87, 75% có 82, 65% có 68, full-size 104), không phím nào chồng nhau hay lọt ra ngoài bàn, và mỗi hàng khối chính rộng đúng 15 đơn vị. `pipeline/hero_keyboard.py` đọc tệp đó để dựng vỏ và từng keycap (ba vòng vát, 18 tam giác một phím; biến thể `d` dùng profile thấp kiểu chiclet), nên thêm một bố cục mới là thêm vào `keyboards.mjs`, chạy lại `node tools/keyboards.mjs` và thêm chữ cái vào `variants`.

Màu và chữ của keycap không nằm trong mô hình. Cả mặt trên lẫn bốn thân keycap dùng hàng ảnh `legend`: mặt trên trỏ vào ô của phím trong atlas (ảnh nhìn từ trên của từng bàn, các bàn xếp chồng thành dải), thân phím trỏ vào một cột hẹp bên trái ô (`atlas.sideColumn`) luôn là màu nền. Lúc chạy, `runtime/keyboard-legends.mjs` vẽ hai atlas bằng Canvas2D theo công thức: ảnh màu và ảnh phát sáng. Công thức chọn trong trường `keyboard` (hợp đồng `shop-look.v1`, trường tuỳ chọn): `colorway` là bộ màu keycap chia ba vùng alpha, modifier và accent theo các bộ phím cơ thật (`neon` lấy dải màu hàng `keycap` của công thức và trong suốt kiểu pudding; `retro`, `graphite`, `arctic`, `rose`, `forest` là màu cố định, danh sách ở `runtime/keyboard-styles.mjs`), `led` là chế độ đèn (`rainbow` theo vị trí phím, `single` theo hàng `strip`, `white`, `off`). Ảnh phát sáng vẽ chữ bằng màu LED (chữ xuyên sáng), viền hở quanh chân phím và dải sáng lan lên thân với bộ pudding, nên bloom và đèn cảnh ăn đúng chỗ. Vật liệu `legend` của `shopMaterials` nhận hai ảnh qua tuỳ chọn `legends` và vẫn nhân lightmap. Mã `code` của từng phím là chỗ nối cho luồng gõ phím về sau.

### Chuột và tai nghe

Chuột (`pipeline/hero_mouse.py`) là một khối subdivision liền: mười hai vòng tiết diện chữ D (đáy phẳng, mép đáy bo, vòm trên là cung siêu elip) xếp dọc thân, vòng đầu và đuôi thu nhỏ vừa phải để mũi tù như chuột thật chứ không nhọn như quả trứng. Nút, đệm hai bên, rãnh giữa và dải sáng đều là hàng màu trên các cột mặt của cùng khối đó, không có mảnh vỏ rời nào nổi phía trên, nên thân không thể chọc xuyên qua nút. Rãnh giữa hạ thấp thật hơn một milimét ở nửa trước; con lăn nằm trong rãnh và chỉ lộ khoảng ba milimét. Nút bên và con lăn ngón cái đặt bằng cùng hàm tiết diện rồi lùi vào trong vỏ, chỉ nhô khoảng một milimét. Ba mẫu: `a` gaming công thái học tay phải (nút hai tông màu, đệm hai bên, hai nút bên, đèn logo ở lưng), `b` thấp và trơn kiểu chuột cảm ứng, một khối liền không con lăn không dải sáng, `c` chuột làm việc vòm cao có chỗ tựa và con lăn ngón cái; đổi mẫu là đổi bảng số đo, không vẽ lại.

Tai nghe (`pipeline/hero_headset.py`) treo trên đế để bàn: vành đầu là loft tiết diện chữ nhật bo góc dọc cung tròn, đệm vành là dải thứ hai bên trong, củ tai là revolve hai mươi cạnh với đệm bo tròn và lưng củ có vòng điểm nhấn, càng kim loại nối vành với trục củ. Ba mẫu: `a` gaming có mic cần và đế phát sáng, `b` studio củ to lưng kim loại, `c` on-ear nhỏ vành mỏng.

### Thùng máy

Ba mẫu, mỗi tiệm mẫu dùng một mẫu. `a` là tháp kính hông có ba quạt trước (`build_case` trong `pipeline/hero_station.py`). `b` và `c` nằm trong `pipeline/hero_cases.py`: `b` là máy mini vuông bo góc đặt trên kệ thấp hai tầng, tầng dưới có hộp lưu trữ, vì ô thùng máy nằm dưới sàn cạnh bàn nên máy mini cần kệ để còn nhìn thấy; `c` là tháp hiện đại thân tối bo góc, mặt trước là hàng nan dọc trên nền lưới tối, nút nguồn và cổng nằm trên nóc, dải sáng chạy ở chân mặt trước và hai bên. Phần phát sáng của cả ba dùng các hàng `strip`, `accent`, `screen` nên ăn theo bộ màu của tiệm. Mỗi mẫu có hộp va chạm riêng khai trong `CASE_COLLISIONS`; thêm mẫu mới thì thêm một dòng ở đó. Chi tiết gắn lên mặt vỏ phải nhô ít nhất 2 mm, và hai khối chồng lên nhau không được chung mặt đáy hay mặt bên, nếu không bộ kiểm đồng phẳng sẽ báo.

### Ô speaker

Hai mẫu trong `pipeline/hero_speakers.py`. `a` là cặp đặt hai bên màn hình, thùng bo góc với hai củ tròn có vành sáng. `b` là một thanh dài 0,6 m nằm giữa bàn dưới màn hình, có dải sáng ở chân mặt trước và núm âm lượng trên nóc. Mẫu nào lắp ở đâu do chính mô hình khai: mẫu mang điểm neo `mount_center` thì `stationPlan` chỉ lắp một chiếc tại `socket_speaker_center` của bàn, mẫu không mang thì lắp hai chiếc tại `socket_speaker_left` và `socket_speaker_right`. Mã chạy không biết tên biến thể nào là thanh, nên thêm mẫu thanh mới chỉ cần gắn điểm neo đó. `socket_speaker_center` nằm trước chân của cả ba mẫu màn hình và sau bàn phím; thanh đứng trên hai đế cao 12 mm để vượt mép lót chuột.

### Pad chuột

Ba pad: `a` có viền sáng và logo, `b` trơn cỡ lớn, `c` trơn cỡ nhỏ đặt lệch về phía chuột (gốc món vẫn ở socket chung, lưới dời sang phải 25 cm) cho kiểu bàn tối giản. Bàn phím và chuột vẫn đặt ở độ cao mặt pad nên với pad nhỏ, bàn phím nổi 4 mm trên mặt bàn; chấp nhận cho tới khi socket theo biến thể.

### Góc console

Bộ ô đồ thứ ba `lounge-parts.glb` (sinh từ `pipeline/make_lounge_kit.py` và `hero_lounge.py`) phục vụ REQ-041 còn ở trạng thái nháp: sofa ba chỗ với đệm ngồi và đệm lưng là pillow subdivision, bàn trà có kệ dưới và hai socket `socket_console`, `socket_gamepad` trên mặt bàn, máy console nằm ngang hai cánh sáng kẹp lõi tối với vạch LED, tay cầm hai báng với hai cần, touchpad và dải sáng, TV 65 inch trên chân giữa với màn hình dùng vật liệu `display`. Các món đổi màu theo công thức như mọi ô đồ khác và nướng AO từng món riêng. Chúng xem được trong lab (bộ ghép "Góc console") và danh mục; công thức tiệm phải khai biến thể cho năm ô này nhưng bố cục tiệm chưa đặt góc console, việc đó chờ REQ-041 được chốt.

### Bộ phố

Bộ ô đồ `street-parts.glb` (sinh từ `pipeline/make_street_kit.py` và `hero_street.py`) mở đầu REQ-039 với lưới ô đường 4 m, gấp đôi ô phòng: mặt hẻm `road` ba biến thể khác nhau ở rãnh thoát nước (hai mép, góc, một mép) cùng nắp cống, vỉa hè `sidewalk` 4 × 1 m có bó vỉa, cột điện bê tông với xà, sứ và hộp biến áp, dây điện võng `wires` nối hai cột cách nhau 4 m, đèn đường có cần vươn ra lòng đường và tấm sáng hàng `strip`, thùng rác, chậu cây và biển chữ A `board` đứng trên vỉa hè với mặt neon hàng `accent` (biển treo và biển vẫy nằm ở bộ biển hiệu riêng). Các tấm mặt hẻm dùng hàng `wall`, thân đường và rãnh thoát nước `body`, gạch vỉa hè `floor` trên nền `top`, bó vỉa và kim loại `metal`, bê tông cột và tán cây `top`, sứ và đất chậu `soft`, dây điện và nóc hộp biến áp `body`, mặt neon `accent`, tấm đèn và nhãn thùng rác `strip`; công thức tiệm hay công thức phố sau này đổi màu được cả hẻm qua các hàng này. Bộ ghép "Hẻm mẫu" trong lab đặt ba ô đường, ba ô vỉa hè, hai cột với dây, đèn và đồ vỉa hè để soi tỷ lệ với nhân vật. Mặt tiền nhà ống (`hero_facade.py`) cũng nằm trong bộ này: module rộng 4 m, mỗi tầng cao 3,8 m, xếp chồng theo trục z; `shopfront` là tầng trệt với cửa cuốn, hộp biển 2 × 0,5 m có mặt chữ `decal` 1,84 × 0,46 m (tỉ lệ 4:1, UV 0..1 để vẽ tên tiệm lúc chạy) viền ống neon `strip` và mái hiên; `storey` có hai mẫu, a với ban công sắt và cửa kính, b với cửa sổ, máy lạnh và ống nước; `roof` là lan can mái, tôn lợp dốc về sau, bồn nước và ăng-ten. Mặt tường gắn tại y = 0 với bề dày 0,3 m, mặt phố hướng −y; kính cửa sổ dùng hàng `screen` nên sáng về đêm; tường `wall`, trụ và sàn ban công `top`, cửa cuốn, khung cửa, lan can, máy lạnh và tôn `metal`, lá cửa cuốn và quạt máy lạnh `body`, vải mái hiên `soft`. Bộ ghép "Nhà ống mẫu" xếp hai căn ba và hai tầng cạnh nhau trên vỉa hè.

Khối phố lắp từ dữ liệu theo hợp đồng `street-block.v1` (`packages/contracts/world/street-block.v1.schema.json`, còn nháp): ô đường 4 m có kiểu rãnh (`straight`, `corner`, `tee`) và hướng, dải vỉa hè bám một cạnh ô, lô tiệm 2 × 2 ô có hướng mặt phố, danh sách tầng lầu, mái và đồ trước cửa, cùng đồ của khối theo mét từ góc tây-bắc. `runtime/street-look.mjs` có `streetPlan(block)` trả danh sách đặt module cùng khuôn với `roomPlan` (mỗi lô hai cột mặt tiền 4 m: trệt, các lầu cao 3,8 m rồi mái; dây điện tự nối hai cột cùng hàng cách một ô), `sidewalkWaypoints` cho bot đi vỉa hè, `roadLane` cho xe, `missingParts` và `blockIssues` để kiểm món có trong bộ và lô không lấn đường, không chồng nhau, không ra ngoài khối. Dải vỉa hè nằm trong mét ngoài cùng của ô đường kề lô nên che rãnh thoát nước ở cạnh đó; đồ phố và dây điện đặt ở cao độ mặt vỉa hè 0,15 m; dây tự nối cả cột xếp dọc trục z. Đồ của lô ghi theo [dọc mặt tiền trái sang phải, ra phố] nên lô quay hướng nào cũng giữ đúng vị trí so với cửa. Khối mẫu nằm ở `blocks/hem-mau.json`; trang `library/street.html` lắp nó với bộ màu của tiệm, có lớp hộp va chạm và lớp điểm chờ/làn; trang báo rõ khi không đọc được dữ liệu. Máy chủ thư viện (`pnpm assets:library`) nạp danh sách thư mục phục vụ lúc khởi động, nên đổi `tools/serve-library.mjs` hay `tools/library-files.mjs` rồi kéo staging là chưa đủ: phải khởi động lại máy chủ đang chạy.

### Module phòng

Phòng ghép từ module trên lưới ô 2 m, tường cao 3,6 m; cửa cao 2,28 m, phần tường phía trên cửa để treo biển; dải hắt sáng của trần mỏng 12 cm với đáy ở 3,36 m. Gốc module ở tâm ô, trên sàn. Tường nằm dọc cạnh −Y của ô và quay mặt vào trong. Ô khai `grid` phải có kích thước là bội số của ô lưới trên các trục đã khai (trục của glTF: 0 là ngang, 2 là sâu), nếu không lệnh xuất báo lỗi. Tường, góc, cửa, cửa sổ mang hộp `collision_*`. Module góc là một khối liền: hai cánh tường cắt ngắn và đâm vào một cột góc 32 cm, nên không có mặt nào chồng lên nhau ở góc; dải trang trí của mọi module chạy hết chiều rộng ô để hai module kề nhau khít mép. Trụ ốp ở hai mép module chỉ chạy từ mép trên dải chân tường tới mép dưới dải đèn, vì trụ cao hết tường có mặt trên trùng phẳng với dải băng trần và nhấp nháy khi nhìn từ trên xuống.

Bề mặt mịn nhờ ba luật trong `pipeline/hero_kit.py`. Một: khi hoàn thiện một món, cạnh nào có hai mặt lệch nhau trên 62° thành cạnh cứng, phần còn lại dùng pháp tuyến có trọng số theo diện tích mặt, nên mặt phẳng lớn giữ phẳng còn phần vát gánh độ cong; chỗ muốn bo mượt qua góc lớn hơn thì thêm vòng đỡ. Hai: trong ảnh bóng nướng, các mảnh UV cách nhau ít nhất 4 điểm ảnh để màu mảnh này không lem sang mảnh kia, bộ món đồ chia chỗ nghiêng về món nhỏ vì chúng được soi gần (mỗi món ít nhất 14% cạnh ảnh), và ảnh bóng được làm mượt một lượt 3×3 sau khi nướng để hết hạt. Ba: bóng nướng 256 mẫu; Cycles không khử nhiễu kết quả nướng nên số mẫu là thứ duy nhất làm sạch nhiễu. Vật tròn cần đủ đoạn xoay để viền không gãy khúc, miễn còn trong mức trần tam giác của ô.

Hai mặt cùng hướng pháp tuyến, cùng phẳng hoặc cách nhau dưới 1,5 mm, mà chồng lên nhau là nguồn nhấp nháy (z-fighting; ở 10–15 m độ phân giải chiều sâu chỉ còn 0,1–0,2 mm), nên `tools/coplanar.mjs` quét mọi bộ ô đồ khi kiểm và khi xuất: gom các mặt vuông góc trục theo mặt phẳng, tính diện tích giao từng cặp, bỏ qua cặp chỉ chạm mép và cặp bị một mặt ngược chiều cùng phẳng của một khối khác che kín (hộp dán lên khối khác); mặt che thuộc chính một trong hai khối thì không được tha, vì đó là tấm mỏng bằng không như đĩa trong của vòng luồn dây trên bàn. Tấm dán mỏng vì vậy đặt cách mặt nền ít nhất 2 mm. Nó kiểm từng món rồi kiểm các cụm ghép của bộ phòng (hai tường liền, góc với hai tường, cửa và cửa sổ giữa hai tường); còn một cặp là lệnh xuất từ chối ghi dấu.

### Công thức tiệm

Mỗi tiệm là một tệp JSON trong `recipes/`, theo hợp đồng `packages/contracts/world/shop-look.v1.schema.json`: `palette` (mỗi hàng màu là một dải gồm một hay nhiều màu), `emissive` (dải phát sáng nhẹ cho hàng bề mặt, tuỳ chọn), `variants` (biến thể cho từng ô đồ), `layout` (kích thước phòng theo ô 2 m, vị trí và hướng từng máy, cửa, cửa sổ), `sign` và `lighting`. Ba tiệm mẫu khác nhau về màu, bố cục, biển và đèn: `tim-neon`, `bien-sau`, `cam-retro`; biến thể của chúng đều là `a` vì mỗi ô mới có một biến thể.

Quy ước toạ độ trong `layout`: `cells` là `[rộng, sâu]` tính bằng ô 2 m; ô `[x, z]` có x đếm từ tường `west` (0) sang `east`, z đếm từ tường `north` (0) xuống `south`; `facing` là hướng người ngồi nhìn, màn hình nằm ở phía đó của ô; `at` của cửa và cửa sổ là chỉ số ô dọc theo tường. Mỗi tiệm có đúng một cửa và ô sàn ngay trong cửa phải để trống. Cửa và cửa sổ không được đặt ở ô góc (ô đầu hay cuối của một bức tường) vì ô góc do module góc liền khối đảm nhiệm. Máy đặt ở ô sát tường không được quay lưng ghế vào bức tường đó: ghế nằm ở phía ngược với `facing`, kê sát tường thì người chơi không đi tới được. Máy sát tường vì thế quay màn hình vào tường hoặc quay ngang. Bộ kiểm công thức chạy trong `pnpm verify`, hoặc riêng bằng `pnpm --filter @netverse/game-assets check:recipes`; nó từ chối công thức trỏ tới biến thể không có, thiếu hay thừa hàng màu, dải phát sáng cho hàng không phải bề mặt, đặt máy ngoài phòng, hai máy chung một ô, máy chắn trước cửa, cửa hay cửa sổ ở ô góc, cửa và cửa sổ trùng chỗ, tệp không phải JSON, hoặc tên tệp khác `id`.

### Mã chạy

`runtime/shop-look.mjs` dựng ảnh dải màu 128×12 từ công thức (nội suy trong không gian tuyến tính rồi đưa về sRGB), đọc socket từ glTF và lập kế hoạch đặt từng món của mọi máy theo `layout`. `runtime/three-shop.mjs` biến kế hoạch đó thành `InstancedMesh` của three.js, mỗi hình khối một lần cho cả tiệm; mô-đun không kéo three.js vào, hàm nào cần three thì nhận nó làm tham số. Đo trên Chrome headless với bộ máy hiện tại: một máy 24 lời gọi vẽ, 50 máy vẫn 24 trong lúc nhân bản thường tốn 1.300; mỗi máy 12.334 tam giác (loa tính hai lần). Đo một lần trên máy phát triển với Intel Iris Xe bằng trang đo ngoài repo: 50 máy instancing mất 0,2 ms CPU mỗi khung so với 8,8 ms của nhân bản thường; thời gian GPU chưa đo. Vật liệu `display` và `decal` hiện chỉ là chỗ giữ tối màu, ảnh màn hình và logo của tiệm làm sau.

`runtime/actor-look.mjs` giữ phần vẽ mặt, logo và chất liệu của nhân vật; trang thư viện nhập mô-đun này thay vì tự vẽ, nên game dùng lại được cùng một bộ mặt và biểu cảm. Máy chủ thư viện và bản xuất bản phục vụ thêm `runtime/`, `recipes/` và `assets.config.json` bên cạnh `exported/`.

### Phòng thử tiệm

Tab "Phòng thử tiệm" của thư viện mở `library/shop.html`: trang dựng cả tiệm từ công thức bằng đúng mã chạy ở trên, gồm phòng ghép từ module theo `layout`, các máy đặt theo socket, biển hiệu trên cửa và đèn theo `lighting`. Trong trang có thể chọn một trong ba tiệm mẫu, sửa từng hàng màu và thêm mốc để thành dải chuyển màu, đổi biến thể theo ô, đổi biển và kiểu đèn, bật lớp điểm neo và hộp va chạm, rồi chép JSON ra để lưu thành công thức mới trong `recipes/` (nhớ thêm `id` vào `recipes/index.json`). Trần tắt mặc định để nhìn từ trên xuống. Nhóm thanh trượt "Ánh sáng" (phơi sáng, đèn nền, đèn điểm, phát sáng, độ mạnh và ngưỡng bloom) chỉnh trực tiếp trên cảnh để chốt mức sáng rồi ghi lại vào preset của `lighting`; mặc định hiện tại giữ bloom thấp (neon 0,35, ngưỡng 0,85) và phát sáng 1,2 để tiệm không bị loá.

### Lightmap nướng sẵn

Tiệm đổi màu theo công thức lúc chạy nên không nướng màu được như các phòng 3D tĩnh; thay vào đó mỗi bộ ô đồ mang một ảnh **AO xám** nướng trong Blender (Cycles, khoảng cách AO 0,6 m cho phòng) trên lớp UV thứ hai `lightmap`, và vật liệu bề mặt nhân màu công thức với ảnh đó. Mỗi món của cụm bàn máy nướng riêng, chỉ có mặt sàn làm vật cản và khoảng cách AO 0,3 m, vì món nào cũng có thể đứng một mình hoặc đổi chỗ theo công thức; nướng chung từng để lại vết đen của màn hình, bàn phím, loa trên mặt bàn khi xem bàn một mình. Từng module phòng nướng với sàn và tường kề làm vật cản để có bóng tiếp xúc ở chân tường và góc. Mỗi món chiếm một ô vuông trong atlas 2048², cạnh tỉ lệ với căn bậc hai diện tích bề mặt. Ảnh đóng gói dạng JPEG trong tệp `.blend` và nối vào nhóm nút "glTF Material Output" nên GLB xuất ra có `occlusionTexture` trên UV 1; three.js tự gắn thành `aoMap`. Vì three.js chỉ nhân `aoMap` vào ánh sáng gián tiếp, `shopMaterials` vá một dòng shader để lightmap nhân cả ánh sáng trực tiếp. Bộ ô đồ khai `lightmap: true` trong `assets.config.json` bị từ chối khi thiếu `TEXCOORD_1` hoặc thiếu ảnh che khuất trên UV 1. Mỗi bộ một atlas nên phòng thử và phòng lab giữ một bộ vật liệu riêng cho từng bộ ô đồ; nút "AO nướng" tắt bật để so sánh.

### Tiệm giới thiệu

`library/showcase.html` mở cảnh `showcase-tim-neon` khai trong mục `scenes` của `assets.config.json`: một phòng hở 3×2 ô (tường bắc và tây, không trần) lắp từ đúng bộ máy và module phòng theo bố cục sinh bằng `roomPlan`/`shopPlan`, xem bằng ống kính 35 độ từ góc hở như các phòng mô hình thu nhỏ. Toàn bộ ánh sáng được nướng trong Blender Cycles với albedo trắng: ảnh `base` là ánh sáng thuần (đèn trần, nền, bóng mềm, GI) và ảnh `spill` là mặt nạ ba kênh — dải phát sáng là R, màn hình là G, điểm nhấn là B; `showcaseMaterials` nhân màu bảng với `base × nền + Σ mask × màu hàng phát sáng × cường độ`, nên cảnh không có đèn thời gian thực mà vẫn đổi màu theo công thức. Script xuất ghi GLB cùng hai JPEG; bộ kiểm từ chối cảnh thiếu `TEXCOORD_1` hoặc thiếu ảnh, và dấu xuất phủ cả ảnh lẫn tệp nguồn. Đây là cách làm học từ các phòng 3D nướng sẵn; mọi tài sản đều tự dựng.

### Phòng lab

Tab "Phòng lab" mở `library/lab.html`: xem riêng từng món của hai bộ ô đồ trên bục xoay dưới ba đèn studio trung tính, kèm số tam giác, kích thước so với khung ô và danh sách điểm neo. Bật được khung dây, điểm neo, hộp va chạm, khung ô và lưới sàn; bốn bộ ghép thử mối nối (góc tường, cửa giữa hai tường, cửa sổ giữa hai tường, trần và đèn) để soi chỗ các module gặp nhau trước khi ghép cả tiệm. Cả hai trang vẽ qua composer có khử răng cưa MSAA bốn mẫu, vì `antialias` của canvas không tác dụng khi đi qua hậu xử lý. Trang lab nhận tham số trên URL để chia sẻ đúng một góc nhìn: `part` (tên món), `view` (`front`, `back`, `side`, `top`, `iso`, `low`), `zoom` (hệ số phóng), `focus` (toạ độ x,y,z tính bằng mét làm tâm nhìn) và `spin=0` để dừng bục xoay; ví dụ `lab.html?part=chair_a&view=low&zoom=2.4&focus=0,0.1,0&spin=0` soi chân ghế.

### Danh mục món đồ

Tab "Danh mục món" mở `library/gallery.html`: lưới thẻ cho mọi biến thể của từng ô đồ trong hai bộ, mỗi thẻ là một cảnh nhỏ vẽ bằng một WebGL context duy nhất qua scissor, dưới cùng ba đèn studio và cùng bộ màu chọn ở đầu trang; thẻ viền tím là biến thể mà công thức đang dùng, nút "Mở trong lab" đưa sang deep link của phòng lab. Trang nhận `recipe=<id>` và `spin=0` trên URL. Đây là chỗ đội nắm thiết kế từng món và cũng là bản xem trước cho chủ tiệm khi chọn đồ; thêm biến thể mới chỉ cần thêm đối tượng `<ô>_<biến thể>` trong tệp gốc và thêm chữ cái vào `variants`. Bàn hiện có ba biến thể cùng mặt bàn 0,704 m và cùng bộ socket: `a` mặt bàn khoét lõm với hai vách hông có dải LED, `b` mặt bàn chữ nhật trên bốn chân thép tròn với khay cáp, `c` mặt bàn mép dày với tủ ba ngăn kéo bên phải và vách bên trái.

## Chuẩn bị

Cần Git LFS và Blender 5.2 trở lên. `pnpm bootstrap` đã bật Git LFS và tải sẵn các tệp. Blender nằm ở vị trí lạ thì đặt biến `BLENDER_PATH`.

## Sửa một tài sản

```
git lfs lock packages/game-assets/source/hair-default.blend
```

1. Tách nhánh từ `staging` theo issue, rồi khoá tệp như trên. Tệp đang bị người khác khoá thì chờ hoặc trao đổi với họ.
2. Mở tệp, sửa, lưu. Giữ nguyên tên đối tượng và tên xương. Apply mọi modifier trừ Armature, vì lệnh xuất từ chối modifier chưa apply. Tệp có `generator` thì không mở sửa tay: sửa script trong `pipeline/` rồi chạy `pnpm assets:generate <tên tệp gốc>`.
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

Giới hạn tam giác từng món nằm trong `assets.config.json`. Bản nhẹ dùng khi cảnh đông người, tự giảm thân và tóc còn tổng khoảng 10.000 tam giác. Bộ bàn máy mười món hiện 14.186 tam giác, bộ module phòng 3.760. Ngày 2026-11-10, sau khi người dùng soi từng món trong phòng lab, ghế được dựng lại theo ngôn ngữ ghế đua tham chiếu (vỏ lưng chữ S, cánh ôm vai, hai khe xuyên ở tựa đầu cắt bằng boolean, đệm có gờ, tay vịn trụ tròn) với ngân sách 8.000 tam giác, và chuột từ 600 lên 1.400 để dựng lại thành vỏ trên dạng lưới cao độ đặt trên đế dưới với đường ron sắc, rãnh chia nút, khe bánh xe, dải sáng và logo đều là mặt của chính vỏ thay vì ống dán rời; 50 máy vẫn dưới một triệu tam giác mỗi khung. Muốn tăng ngân sách thì nêu lý do trong PR, và kiểm lại FPS trên GPU thật.

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
