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

Test khói chỉ chạy khi mô hình là tệp thật; trên máy chưa `git lfs pull` hoặc trên CI chưa tải LFS thì ca đó được ghi là bỏ qua, không phải xanh.

Tham số trên URL: `?shop=<id>` chọn tiệm mẫu, `?quality=low|medium|high` ép mức chất lượng, `?probe=context-loss` giả lập mất ngữ cảnh WebGL để kiểm khôi phục.

## Cấu trúc

```
app/                  layout, trang và component giữ canvas, nơi duy nhất nối giao diện với cảnh
src/state/            kho Redux Toolkit: slice và store, chỉ import @reduxjs/toolkit
src/scene/            dựng cảnh three.js từ công thức, nhân vật, mức chất lượng; lớp duy nhất dùng three
src/types/            khai kiểu cho mã chạy JavaScript của game-assets
src/ui/               giao diện React phủ trên canvas, đọc kho bằng useSelector và gửi lệnh bằng dispatch
src/ui/text/vi.ts     mọi câu người chơi thấy, component gọi theo khoá
scripts/              chép tài sản vào public, máy chủ xem bản xuất tĩnh
test/                 thử trang bằng Chrome headless trên bản xuất tĩnh
```

Mỗi component có một tệp `.module.css` cạnh nó; màu, cỡ chữ và khoảng cách lấy từ biến trong `app/globals.css`. Kho trạng thái chỉ giữ thứ đổi thưa mà giao diện cần (số đo mỗi nửa giây, mức chất lượng, lỗi, tiệm đang chọn); vị trí và khung xương không đi qua kho. Luật ranh giới giữa các lớp ở `docs/wiki/engineering/web-client.md`.

Bảng đo hiện FPS, lời gọi vẽ và tam giác của mỗi khung, kể cả hậu xử lý. Mức chất lượng chọn theo máy: điện thoại hoặc máy yếu ở mức thấp, đồ hoạ tích hợp ở mức vừa, card rời ở mức cao; đổi được bằng tay. Mất ngữ cảnh WebGL thì cảnh tự dựng lại khi trình duyệt trả lại ngữ cảnh.

Docker: build từ gốc repo, `docker build -f apps/web-3d/Dockerfile .`, ra một ảnh nginx phục vụ bản xuất tĩnh.

Trước khi thêm mã, đọc [chuẩn thành phần](../../docs/wiki/engineering/component-standard.md).
