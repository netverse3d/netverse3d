# game-shared

Package dùng chung: luật chơi chạy giống nhau ở client và game server, không phụ thuộc Three.js hay trình duyệt.

- Stack: JavaScript (ES module), chạy trên Node và trình duyệt
- Milestone: M2
- Trạng thái: có di chuyển và va chạm trên mặt sàn

## Di chuyển và va chạm

`@netverse/game-shared/movement` có hàm `stepPlayer(player, intent, obstacles, seconds)`:

- `player` là `{ x, z, yaw }` trên mặt sàn, đơn vị mét, `yaw` bằng 0 khi nhìn về +z.
- `intent` là `{ x, z, run }`, vector dài tối đa 1. Phím và cần ảo cùng đưa về vector này.
- `obstacles` là danh sách hộp `{ minX, maxX, minZ, maxZ }` song song với trục.
- Hàm trả về trạng thái mới và không sửa trạng thái cũ.

Người chơi là hình tròn bán kính `PLAYER_RADIUS`. Chạm tường thì trượt dọc tường. Bước thời gian dài được chia nhỏ nên không đi xuyên tường mỏng.

## Chạy test

```
pnpm --filter @netverse/game-shared test
```

Trước khi thêm mã vào đây, đọc [chuẩn thành phần](../../docs/wiki/engineering/component-standard.md).
