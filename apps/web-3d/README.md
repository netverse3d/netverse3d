# web-3d

Ứng dụng: Web 3D và PWA cho người chơi và chủ tiệm.

- Stack: Next.js (xuất tĩnh), React, Three.js, TypeScript
- Milestone: M1
- Trạng thái: khung đầu tiên, dựng một tiệm từ công thức và đặt nhân vật ở cửa

## Chạy

```
pnpm --filter @netverse/web-3d dev
pnpm --filter @netverse/web-3d build
pnpm --filter @netverse/web-3d preview
pnpm --filter @netverse/web-3d test
```

`dev` và `build` chép mô hình, công thức và `assets.config.json` từ `packages/game-assets` vào `public/game-assets/` (thư mục này không commit). Máy cần `git lfs pull` để có mô hình thật.

Tham số trên URL: `?shop=<id>` chọn tiệm mẫu, `?quality=low|medium|high` ép mức chất lượng, `?probe=context-loss` giả lập mất ngữ cảnh WebGL để kiểm khôi phục.

## Cấu trúc

```
app/                  layout và trang Next.js
src/scene/            dựng cảnh three.js từ công thức, nhân vật, mức chất lượng
src/types/            khai kiểu cho mã chạy JavaScript của game-assets
src/ui/               lớp giao diện React: bảng đo, chọn tiệm, chọn chất lượng
scripts/              chép tài sản vào public, máy chủ xem bản xuất tĩnh
test/                 thử trang bằng Chrome headless trên bản xuất tĩnh
```

Bảng đo hiện FPS, lời gọi vẽ và tam giác của mỗi khung, kể cả hậu xử lý. Mức chất lượng chọn theo máy: điện thoại hoặc máy yếu ở mức thấp, đồ hoạ tích hợp ở mức vừa, card rời ở mức cao; đổi được bằng tay. Mất ngữ cảnh WebGL thì cảnh tự dựng lại khi trình duyệt trả lại ngữ cảnh.

Docker: build từ gốc repo, `docker build -f apps/web-3d/Dockerfile .`, ra một ảnh nginx phục vụ bản xuất tĩnh.

Trước khi thêm mã, đọc [chuẩn thành phần](../../docs/wiki/engineering/component-standard.md).
