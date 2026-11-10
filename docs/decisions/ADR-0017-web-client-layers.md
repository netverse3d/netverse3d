# ADR-0017: Client game chia lớp, cảnh 3D và giao diện chỉ gặp nhau ở kho trạng thái

- Trạng thái: accepted
- Ngày: 2026-11-10

## Bối cảnh

`apps/web-3d` chứa hai thứ có nhịp sống khác hẳn nhau:

- Thế giới 3D vẽ lại 60 lần mỗi giây bằng Three.js và tự giữ bộ nhớ GPU.
- Giao diện 2D (đăng nhập, hộp thuê máy, đồng hồ phiên) là React, chỉ vẽ lại lúc dữ liệu đổi.

Để React vẽ lại theo từng khung hình thì game giật. Để mã Three.js gọi thẳng vào component thì luật chơi không test được nếu thiếu trình duyệt. Nhiều người và nhiều công cụ AI cùng viết vào thư mục này, nên chỗ đặt mã và hướng phụ thuộc phải được chốt trước lúc có mã vòng chơi.

## Quyết định

- Toàn bộ giao diện người chơi và chủ tiệm nằm trong `apps/web-3d`. Ứng dụng xuất tĩnh, không cần server Node để phục vụ trang.
- `apps/web-3d` có sáu lớp, mỗi lớp một thư mục:

| Thư mục      | Chứa gì                                                              | Được dùng                              | Không được dùng                       |
| ------------ | -------------------------------------------------------------------- | -------------------------------------- | ------------------------------------- |
| `app/`       | Trang, route, component gắn canvas; nơi ghép các lớp lại             | React, mọi lớp trong `src/`            | Three.js                              |
| `src/ui/`    | Component React phủ trên canvas                                      | React, `src/state/`                    | Three.js, `scene`, `game`, `net`      |
| `src/state/` | Kho trạng thái nối game với giao diện                                | `packages/game-shared`                 | React, Three.js, mọi lớp khác         |
| `src/scene/` | Three.js: dựng tiệm, nhân vật, camera, ánh sáng, mức chất lượng      | Three.js, `state`, `game`              | React, `ui`, `app`                    |
| `src/game/`  | Vòng lặp và luật phía client: nhập phím, cần ảo, tương tác, ngồi máy | `state`, `net`, `packages/game-shared` | React, Three.js, `ui`, `scene`, `app` |
| `src/net/`   | Kết nối phòng: bản WebSocket và bản giả                              | `state`, `packages/game-shared`        | React, Three.js, `ui`, `scene`, `app` |

- Cảnh 3D và giao diện không gọi nhau. Game ghi vào kho trạng thái, giao diện đọc; giao diện gửi lệnh vào kho trạng thái, game nhận.
- Luật chơi mà server cũng cần (di chuyển, va chạm, nhịp mô phỏng, giao thức phòng) nằm ở `packages/game-shared`, không dùng Three.js, React hay mã của ứng dụng.
- Room server giả nằm ở `apps/web-3d/dev/`, không vào bản build production, theo [ADR-0013](./ADR-0013-vertical-slice-roadmap.md).
- Lệnh `pnpm boundaries:check` kiểm các hướng phụ thuộc trên và chạy trong `pnpm verify`. Thêm lớp mới thì thêm luật vào `scripts/boundaries/rules.mjs` trong cùng PR.

## Hệ quả

- Luật chơi và trạng thái test được bằng Node, không cần trình duyệt.
- Đổi giao diện không chạm vào cảnh 3D, và ngược lại.
- Component gắn canvas phải nằm ở `app/`, vì đó là nơi duy nhất được biết cả React lẫn cảnh 3D.
- Mỗi tính năng mới phải tách làm hai phần: phần ghi trạng thái ở `game` hoặc `scene`, phần hiển thị ở `ui`. Tốn thêm một bước so với gọi thẳng.
- Chi tiết cách làm nằm ở [wiki client game](../wiki/engineering/web-client.md).

Liên quan: REQ-036, [ADR-0004](./ADR-0004-game-core-boundary.md), [ADR-0016](./ADR-0016-shop-identity-as-data.md).
