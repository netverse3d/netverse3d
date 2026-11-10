# game-shared

Package dùng chung: luật chơi chạy giống nhau ở client và game server, không phụ thuộc Three.js hay trình duyệt.

- Stack: TypeScript, build ra ES module chạy trên Node và trình duyệt
- Milestone: M2
- Trạng thái: có di chuyển và va chạm trên mặt sàn

## Di chuyển và va chạm

`@netverse/game-shared/movement` có hàm `stepPlayer(player, intent, obstacles, seconds)`:

- `player` là `{ x, z, yaw }` trên mặt sàn, đơn vị mét, `yaw` bằng 0 khi nhìn về +z.
- `intent` là `{ x, z, run }`, vector dài tối đa 1. Phím và cần ảo cùng đưa về vector này.
- `obstacles` là danh sách hộp `{ minX, maxX, minZ, maxZ }` song song với trục.
- Hàm trả về trạng thái mới và không sửa trạng thái cũ.

Người chơi là hình tròn bán kính `PLAYER_RADIUS`.

- Chạm tường thì trượt dọc tường, kể cả khi tường ghép từ nhiều hộp kề nhau.
- Khe hẹp hơn thân người thì không lọt qua.
- Quãng đi được chia thành các sải ngắn nên không xuyên tường mỏng.
- `seconds` lớn hơn `MAX_STEP_SECONDS` bị cắt về trần đó. `seconds` hoặc `intent` không phải số hữu hạn thì người chơi đứng yên.
- Đang lấn vào hộp, ví dụ vừa xuất hiện, thì được đẩy ra qua cạnh gần nhất.
- Vòng qua góc hộp có thể đi dài hơn quãng của một bước vài phần trăm.

## Chạy test

```
pnpm --filter @netverse/game-shared test
pnpm --filter @netverse/game-shared lint
pnpm --filter @netverse/game-shared build
```

Trước khi thêm mã vào đây, đọc [chuẩn thành phần](../../docs/wiki/engineering/component-standard.md).
