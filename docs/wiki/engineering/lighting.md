# Chuẩn ánh sáng dùng chung

Ánh sáng của game và các trang thư viện lấy dữ liệu từ `packages/game-assets/runtime/lighting.mjs`. Mỗi cảnh chọn một preset có tên; trang không tự tạo đèn, nền, sương, ánh xạ tông màu hoặc bloom. Chuẩn này thực hiện [ADR-0019](../../decisions/ADR-0019-registered-parts-and-one-render-standard.md).

## Màu và đầu ra

Các gói game và game-assets ghim Three.js `0.170.0`. Màu của vật liệu, nền và đèn viết bằng mã hex sRGB, ví dụ `#a66bff`. Three.js làm việc trong Linear-sRGB; renderer xuất `THREE.SRGBColorSpace` và áp `THREE.ACESFilmicToneMapping`. `toneMappingExposure` lấy từ preset, không đặt riêng ở nơi gọi. Khi dùng chuỗi hậu kỳ, dùng `OutputPass` để hoàn tất ánh xạ tông và chuyển màu trước khi xuất.

`PointLight.intensity` của Three.js 0.170 là candela (cd); `distance` giới hạn tầm chiếu và `decay` điều khiển mức giảm sáng theo khoảng cách. Các preset tiệm hiện đặt `distance: 12` và `decay: 1.6` để khớp hình ảnh đã duyệt. Đây là thông số hiệu chỉnh của dự án; Three.js dùng `decay: 2` làm mặc định cho suy giảm theo định luật nghịch đảo bình phương, nên không coi `1.6` là chuẩn vật lý phổ quát. Cường độ của đèn bán cầu và đèn định hướng trong bảng là giá trị điều chỉnh của cảnh, không ghi đơn vị candela.

Tham khảo: [Color Management](https://threejs.org/manual/#en/color-management), [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [PointLight](https://threejs.org/docs/pages/PointLight.html).

## Các preset hiện có

Mọi preset dùng ACES Filmic. Bloom có bán kính `0.4` và ngưỡng `0.85`; cột cuối là cường độ riêng của preset.

| ID               | Cảnh                   | Nền          | Phơi sáng | Môi trường                     | Sương                           | Bloom strength |
| ---------------- | ---------------------- | ------------ | --------: | ------------------------------ | ------------------------------- | -------------: |
| `studio`         | Studio                 | `#141026`    |     `1.0` | Phòng, `0.8`, mờ `0.04`        | Không                           |         `0.35` |
| `shop-neon`      | Tiệm neon              | `#0d0a18`    |     `1.0` | Phòng, `0.3`, mờ `0.04`        | Không                           |         `0.35` |
| `shop-dim`       | Tiệm trầm              | `#0d0a18`    |     `0.9` | Phòng, `0.3`, mờ `0.04`        | Không                           |         `0.30` |
| `shop-warm`      | Tiệm ấm                | `#0d0a18`    |     `1.0` | Phòng, `0.3`, mờ `0.04`        | Không                           |         `0.15` |
| `shop-daylight`  | Tiệm sáng              | `#0d0a18`    |    `1.05` | Phòng, `0.3`, mờ `0.04`        | Không                           |         `0.05` |
| `street-night`   | Phố đêm                | Bầu trời đêm |     `1.0` | Bầu trời đêm, `0.45`, không mờ | `#24193d`, từ `16 m` đến `90 m` |         `0.35` |
| `showcase-baked` | Tiệm dựng sẵn ánh sáng | `#080614`    |     `1.0` | Tắt                            | Không                           |         `0.20` |

| ID               | Hemisphere (sky / ground, cường độ) | Directional (màu, cường độ, vị trí)                                                                | Point light (màu, cường độ)          |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `studio`         | `#ffffff` / `#2a2a33`, `0.7`        | `#fff4e6`, `1.2`, `[3, 5, 4]`; `#dbe6ff`, `0.8`, `[-4, 2.5, 2]`; `#ffffff`, `0.9`, `[-1, 3.5, -5]` | Không                                |
| `shop-neon`      | `#4a36b8` / `#120c24`, `0.5`        | Không                                                                                              | `#a66bff`, `7 cd`; `#5ce1ff`, `7 cd` |
| `shop-dim`       | `#1f3a44` / `#06100f`, `0.3`        | Không                                                                                              | `#1ee8d2`, `5 cd`; `#0aa0ff`, `5 cd` |
| `shop-warm`      | `#ffb347` / `#1a110a`, `0.6`        | Không                                                                                              | `#ff9f1c`, `7 cd`; `#ff6f3c`, `7 cd` |
| `shop-daylight`  | `#ffffff` / `#8899aa`, `1.2`        | Không                                                                                              | `#ffffff`, `3 cd` mỗi đèn            |
| `street-night`   | `#3c2e74` / `#120c24`, `0.85`       | Trăng `#9fb4ff`, `1.1`, `[10, 20, 8]`                                                              | Không                                |
| `showcase-baked` | Không                               | Không                                                                                              | Không                                |

`street-night` dùng `NIGHT_SKY`: đỉnh `#080614`, giữa `#140f2d`, chân trời `#24193d`, quầng thành phố `#342258`, nền đất `#0c0a18`. Hai point light của preset tiệm đặt theo góc phòng; mỗi đèn có tầm chiếu `12 m` và `decay: 1.6`. Các vị trí directional và các giá trị hemisphere lấy trực tiếp từ preset.

`STANDARD_BLOOM` là `{ strength: 0.35, radius: 0.4, threshold: 0.85 }`. Mỗi preset có thể giảm `strength`, nhưng `radius` và `threshold` phải giữ giá trị chuẩn; test sẽ chặn sai lệch.

## Thêm preset

1. Thêm dữ liệu vào `LIGHTING_PRESETS` trong `runtime/lighting.mjs`, khai đủ `id`, `kind`, `toneMapping`, `exposure`, `background`, `environment`, `fog`, `hemisphere`, `directional`, `points` và `bloom`.
2. Nếu công thức tiệm dùng preset, thêm enum vào `packages/contracts/world/v1/shop-look.schema.json` và ánh xạ trong `SHOP_PRESET_IDS`/`lightingFor`.
3. Giữ mã dựng đèn, bầu trời, sương, môi trường và bloom trong `runtime/lighting.mjs`. Runtime nhận `THREE` qua tham số; không import `three` trực tiếp.
4. Bổ sung test cho trường preset, ánh xạ enum, bloom chuẩn và hành vi khi gặp ID lạ. ID không biết phải ném `RangeError`, không tự rơi về preset mặc định.
5. Chạy `pnpm --filter @netverse/game-assets test` và `pnpm --filter @netverse/web-3d test`; chụp lại các cảnh chịu ảnh hưởng ở cùng kích thước để so sánh.

## Cổng kiểm nguồn

`packages/game-assets/tools/lighting-gate.test.mjs` quét `apps/web-3d/src`, `packages/game-assets/library` và các mô-đun runtime ngoài `runtime/lighting.mjs`. Cổng chặn nơi khác tự tạo đèn Three.js, tự gán `toneMapping`, `toneMappingExposure`, `outputColorSpace`, `scene.fog`, `scene.environment`, `scene.background`, tự tạo `RoomEnvironment` hoặc tự khai số bloom trong `UnrealBloomPass`.

`packages/game-assets/library/studio.html` là ngoại lệ duy nhất hiện tại vì đây là trang cũ nhiều cảnh được giữ lại theo phạm vi đã chốt. Ngoại lệ phải chỉ đúng tệp và có lý do trong `LIGHTING_ALLOWLIST`; không thêm ngoại lệ để né lỗi của cảnh mới.

Chạy cổng riêng bằng `node --test packages/game-assets/tools/lighting-gate.test.mjs`, hoặc chạy toàn bộ bằng `pnpm --filter @netverse/game-assets test`.
