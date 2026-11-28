# Ngân sách hiệu năng thành phố

Trang này đề xuất mức khởi đầu cho REQ-042, REQ-004 và REQ-019. Các mức cần được chốt lại sau khi đo trên điện thoại thật và GPU tích hợp. Cảnh là dữ liệu, chỉ đặt part đã đăng ký theo [ADR-0019](../../decisions/ADR-0019-registered-parts-and-one-render-standard.md).

## Phép đo hẻm mẫu

Hẻm mẫu trên `staging` vốn đã gộp bản sao bằng `InstancedMesh` trong `buildShop`; bảng dưới so cách lắp đó với cách nhân bản từng món (`?assembly=clones`) để thấy phần lời gọi vẽ mà instancing tiết kiệm. Trước thay đổi này, bộ đếm của `library/street.html` đọc `renderer.info` sau pass bloom nên chỉ hiện 1 lời gọi vẽ; nay bộ đếm lấy số của pass cảnh.

Chạy `node packages/game-assets/tools/measure-street.mjs` để đọc GLB đã xuất và kế hoạch của `blocks/hem-mau.json` (12 ô, 31 lần đặt part phố, bốn xe). Số lời gọi vẽ ở bảng đầu là số primitive phải gửi cho cảnh, không gồm các pass hậu xử lý, lưới phụ và hạt thời tiết.

| Chỉ số                                           |                   Nhân bản từng món |                      Gộp instancing |
| ------------------------------------------------ | ----------------------------------: | ----------------------------------: |
| Lời gọi vẽ phố                                   |                                  49 |                                  22 |
| Lời gọi vẽ xe                                    |                                  25 |                                  25 |
| Tổng lời gọi vẽ                                  |                                  74 |                                  47 |
| Tam giác phố                                     |                              12.960 |                              12.960 |
| Tam giác xe                                      |                               7.948 |                               7.948 |
| Tổng tam giác                                    |                              20.908 |                              20.908 |
| Bộ nhớ ảnh phố và xe, RGBA × 1,33 mip            |         44.627.394 byte (42,56 MiB) |         44.627.394 byte (42,56 MiB) |
| Lời gọi vẽ đo bằng `renderer.info` của pass cảnh |                                  74 |                                  49 |
| Tam giác đo bằng `renderer.info` của pass cảnh   |                              20.008 |                              20.920 |
| Khung hình mỗi giây, Chrome headless SwiftShader |                                 1,4 |                                 1,3 |
| FPS điện thoại                                   | Chưa đo, cần đo tay trên điện thoại | Chưa đo, cần đo tay trên điện thoại |

Hai ảnh JPEG nhúng trong `street-parts.glb` và `vehicle-parts.glb` đều 2.048 × 2.048. Công thức bộ nhớ chỉ tính hai ảnh này, chưa gồm palette sinh lúc chạy, framebuffer, bóng, bloom và ảnh của các bộ khác. Số `renderer.info` đo bằng Chrome headless qua giao thức DevTools sau 45 giây, góc nhìn mặc định, ở 1.400 × 850 với SwiftShader. Số tam giác của cách nhân bản thấp hơn vì từng bản sao bị cắt theo khung nhìn riêng, còn `InstancedMesh` cắt theo cả nhóm. Số đo lệch vài lời gọi so với phép đếm vì cảnh có thêm vật ngoài kế hoạch đặt part, như lưới mưa, và vì phần bị cắt theo khung nhìn. SwiftShader dựng bằng CPU nên số khung hình chỉ để so tương đối, không đại diện thiết bị thật; cần đo lại trên máy có GPU và trên điện thoại.

## Mức đề xuất

| Phạm vi hiển thị                 | Tam giác |       Lời gọi vẽ |            Ảnh resident |              Đèn động |
| -------------------------------- | -------: | ---------------: | ----------------------: | --------------------: |
| Một khu quanh người chơi         |  250.000 |              300 |                  64 MiB | Tối đa 6 mỗi khối phố |
| Một ô 4 m, phần hình học phân bổ |   12.000 | 12 trước khi gộp | Ảnh dùng chung theo khu |         Theo khối phố |

Hẻm mẫu dùng trung bình 1.742 tam giác và 3,9 lời gọi vẽ sau gộp trên một ô; đây chỉ là trung bình của cảnh mẫu, không phải trần cho một ô đông vật. 12 ô ở trần tam giác chiếm 144.000, để lại 106.000 cho người, xe và hiệu ứng trong khu. Bộ ảnh hiện chiếm 42,56 MiB, nên 64 MiB để lại khoảng 21,44 MiB cho ảnh khác. Các trần này là mục tiêu lập kế hoạch, chưa là ngưỡng tự động chặn asset.

| Loại part                                          | Trần đề xuất mỗi món | `maxTriangles` hiện tại |
| -------------------------------------------------- | -------------------: | ----------------------: |
| Mặt đường `road`                                   |                  600 |                     600 |
| Vỉa hè `sidewalk`                                  |                  300 |                     300 |
| Mặt tiền `shopfront`                               |                  600 |                     600 |
| Tầng nhà `storey`                                  |                1.000 |                   1.000 |
| Mái `roof`                                         |                  700 |                     700 |
| Đồ phố nhỏ `bin`, `board`, `lamp`, `pole`, `wires` |                  900 | 300, 300, 700, 900, 500 |
| Chậu cây `planter`                                 |                1.500 |                   1.500 |
| Xe máy `motorbike`                                 |                1.800 |                   1.800 |
| Ô tô `car`                                         |                3.000 |                   3.000 |
| Đèn tín hiệu `signal`, `walk`                      |                1.500 |            1.500, 1.000 |

Các trần đề xuất bằng hoặc cao hơn trần từng món hiện có. Tổng ngân sách khu còn phụ thuộc số lần đặt part, người và hiệu ứng; cần kiểm tổng ở runtime trước khi tải thêm một khối phố.

## Instancing và LOD

`runtime/street-instancing.mjs` gộp mỗi primitive tĩnh của cùng part thành một `InstancedMesh`, giữ vị trí và góc quay riêng. Thân xe cần sơn theo xe, bánh, đèn xe, bóng `*_bulb_*` và hình `walk_a_stop/go` là đối tượng riêng để điều khiển khi chạy. Xe hiện được dựng riêng qua `createVehicle`. Trang hẻm dùng chế độ gộp mặc định; `?assembly=clones` nhân bản từng món để so sánh.

Một ô trong `assets.config.json` có thể khai `"lod": { "suffix": "low", "distance": 32 }` bên cạnh `variants`. Tên part nhẹ của `storey_a` là `storey_a_low` trong cùng bộ đã đăng ký; khoảng cách tính bằng mét từ camera tới part, chuyển sang bản nhẹ khi `distance >= 32`. `validateKitLod` kiểm hậu tố, khoảng cách dương và tên không trùng biến thể; không khai `lod` thì luôn dùng part gốc. `selectStreetLod` chỉ chọn tên, chưa tạo mesh nhẹ hay tự chuyển LOD trong trang hẻm. Khi có mesh nhẹ, phải đăng ký và xuất theo quy trình tài sản hiện hành.

Ở chất lượng thấp, tắt A5 (quầng mềm và tia sáng qua khe nhà), M1 (phản chiếu mặt đường ướt) và T1 (hạt mưa xiên nhìn thấy; trạng thái thời tiết vẫn đổi). Giữ trạng thái thời tiết và tín hiệu giao thông để người cùng khu vẫn thấy cùng logic.

## Tải khu theo vị trí người chơi cho #242

Chia bản đồ theo hợp đồng `city-map.v1` thành khu và khối phố có hộp giới hạn; `mapBounds(map, { blocks })` tính giới hạn từ dữ liệu bản đồ và kích thước khối. Client nạp trước khu đang đứng cùng các khối tiếp giáp trong bán kính nhìn; khi người chơi tiến gần rìa, nạp khu kế trước khi qua ranh. Giữ vùng đệm khi rời khu để tránh tải lại liên tục. Khi khu ra ngoài vùng đệm, huỷ instance, vật liệu riêng của xe và tài nguyên không còn tham chiếu; ảnh và hình học dùng chung chỉ huỷ khi không khu nào dùng. Tính ngân sách theo tổng khu đang resident, ưu tiên giảm LOD và hiệu ứng trước khi hoãn nạp khối xa. Cần đo thời gian nạp, bộ nhớ và giật khung trên điện thoại trong #242.
