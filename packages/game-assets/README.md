# game-assets

Tệp Blender gốc, mô hình glTF xuất ra và bộ kiểm của nhân vật, đồ vật.

- Stack: Blender 5.2, glTF, Node.js cho bộ kiểm
- Milestone: M1
- Trạng thái: đã có phần base của nhân vật và bàn máy

```
source/              tệp .blend, là bản gốc, lưu bằng Git LFS
exported/            tệp .glb do lệnh xuất tạo ra, không sửa tay
assets.config.json   hợp đồng: xương, clip, mesh, ngân sách tam giác
tools/               lệnh xuất và bộ kiểm
```

```
pnpm assets:export
pnpm assets:check
```

Quy trình đầy đủ nằm ở [Tài sản 3D](../../docs/wiki/engineering/game-assets.md). Quyết định nền tảng nằm ở [ADR-0015](../../docs/decisions/ADR-0015-blender-sources-as-master.md).
