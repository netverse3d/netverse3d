# game-shared

Package dùng chung: luật chơi chạy giống nhau ở client và game server, không phụ thuộc Three.js hay trình duyệt.

- Stack: TypeScript, build ra ES module chạy trên Node và trình duyệt
- Milestone: M2
- Trạng thái: có di chuyển và va chạm, nhịp mô phỏng cố định, giao diện kết nối phòng

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

## Nhịp mô phỏng cố định

`@netverse/game-shared/simulation` tách luật chơi khỏi tốc độ khung hình. Luật chạy `TICK_RATE` nhịp mỗi giây, mỗi nhịp dài đúng `TICK_SECONDS`, nên máy 144 Hz và máy 20 Hz ra cùng một trạng thái sau cùng số nhịp.

- `createSimulation(state)` tạo mô phỏng.
- `advanceSimulation(simulation, frameSeconds, step)` gọi mỗi khung hình và trả mô phỏng mới. Hàm `step(state, seconds, tick)` được gọi đủ số nhịp đã tới hạn, `tick` đếm liền mạch từ 0; thời gian dư cộng dồn sang khung sau.
- Mô phỏng trả về có `previous`, `current` và `alpha` (0 đến dưới 1) để vẽ giữa hai nhịp bằng `interpolatePlayer(previous, current, alpha)`. Hướng nhìn quay theo cung ngắn nhất.
- Khung hình đứng lâu chỉ chạy bù tối đa `MAX_TICKS_PER_FRAME` nhịp, phần còn lại bỏ. Máy dưới 6 khung hình mỗi giây vì thế chạy chậm hơn thời gian thật.
- `step` ném lỗi thì cả khung hình đó không được ghi nhận; đừng gửi thông điệp từ trong `step`.

## Kết nối phòng

Client nói chuyện với phòng qua `createRoomClient(connection)` trong `@netverse/game-shared/room-client`. Room server giả và game server thật cùng cắm vào bằng một `connection` có ba hàm:

- `send(text)`: gửi một thông điệp dạng JSON; ném lỗi nếu chưa gửi được.
- `listen(onText)`: đăng ký nhận thông điệp, trả về hàm huỷ đăng ký.
- `close()`: đóng kết nối. Client là bên giữ kết nối và gọi hàm này đúng một lần.

Client có `join`, `move`, `requestSeat`, `leaveSeat`, `subscribe`, `close`. Sau `close()` thì `close()` gọi lại không làm gì, các hàm còn lại ném lỗi.

`room()` trả trạng thái phòng:

- `tick`: nhịp của server, bằng -1 khi chưa nhận gì.
- `players`: người chơi theo `playerId`, mỗi người là `{ playerId, x, z, yaw, seatId }`, cùng hình dạng với `stepPlayer` và `interpolatePlayer`.
- `seats`: máy đang bận và người đang ngồi, luôn khớp với `seatId` của từng người.
- `denied`: lần bị từ chối máy gần nhất, được gỡ lúc xin máy lần nữa.
- `error`: lỗi gần nhất từ server, được gỡ lúc nhận snapshot kế tiếp.

Thông điệp hỏng không làm đổi trạng thái và được đếm ở `rejected()`.

Người nghe đăng ký bằng `subscribe`:

- Được báo sau mỗi thông điệp server được áp, kể cả thông điệp lặp lại nội dung cũ. Thông điệp bị bỏ (hỏng, delta cũ, cấp máy cho người không có trong phòng) thì không báo.
- Thay đổi phát sinh giữa một lượt báo được xếp hàng: mọi người nghe thấy đủ từng trạng thái, đúng thứ tự.
- Người nghe ném lỗi thì các người nghe còn lại vẫn được báo, sau đó lỗi được gom vào một `AggregateError` có thông điệp `Room listeners failed`. Lỗi gửi của `connection` thì ném nguyên dạng.

Người chơi trên đường truyền không có khoá `seatId` được hiểu là không ngồi máy nào.

Thông điệp theo giao thức nháp `packages/contracts/realtime/protocol.v1.schema.json`. Phần dựng và đọc thông điệp nằm ở `@netverse/game-shared/room-protocol`.

Chưa có, sẽ bổ sung lúc ghép game server thật:

- Trạng thái kết nối (đang mở, đã rớt) và nối lại.
- `playerId` của chính mình: giao thức nháp chưa có hồi đáp cho `join`.
- Đối chiếu vị trí client tự tính với vị trí server trả về. `move` hiện gửi vị trí do client tính; nếu game server thật tự tính vị trí từ ý định di chuyển thì `move` và giao thức phải đổi.

## Chạy test

```
pnpm --filter @netverse/game-shared test
pnpm --filter @netverse/game-shared lint
pnpm --filter @netverse/game-shared build
```

Trước khi thêm mã vào đây, đọc [chuẩn thành phần](../../docs/wiki/engineering/component-standard.md).
