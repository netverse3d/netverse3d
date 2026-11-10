# game-assets

Tệp Blender gốc, mô hình glTF xuất ra và bộ kiểm của nhân vật, đồ vật.

- Stack: Blender 5.2, glTF, Node.js cho bộ kiểm
- Milestone: M1
- Trạng thái: đã có nhân vật, bộ ô đồ bàn máy mười món và bộ module phòng

```
source/              tệp .blend, là bản gốc, lưu bằng Git LFS
exported/            tệp .glb do lệnh xuất tạo ra, không sửa tay
assets.config.json   hợp đồng: xương, clip, mesh, ô đồ, điểm neo, bộ màu, ngân sách tam giác
recipes/             công thức tiệm mẫu theo hợp đồng shop-look của contracts
runtime/             mã chạy dùng chung: dải màu, lắp máy theo socket, instancing
library/             trang xem trực quan các thiết kế đã có, shop.html là phòng thử tiệm
tools/               lệnh xuất, bộ kiểm, máy chủ xem thư viện
```

```
pnpm assets:library
pnpm assets:export
pnpm assets:check
```

`library/models/` chứa hai mô hình thử nghiệm cũ chỉ để xem, không có tệp gốc.

Quy trình đầy đủ nằm ở [Tài sản 3D](../../docs/wiki/engineering/game-assets.md). Quyết định nền tảng nằm ở [ADR-0015](../../docs/decisions/ADR-0015-blender-sources-as-master.md).
