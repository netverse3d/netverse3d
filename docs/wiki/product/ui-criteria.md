# Tiêu chí giao diện 2D

[REQ-052](../../requirements/registry.yaml) và [ADR-0040](../../decisions/ADR-0040-saigon-soft-future-ui.md) quy định hệ thiết kế Saigon Soft-Future cho giao diện 2D. Phạm vi và hướng tham chiếu ghi tại [#415](https://github.com/netverse3d/netverse3d/issues/415).

> Style Direction 04 định hướng màu, không khí và bố cục. Giao diện thực tế dùng thiết kế của nhóm và được duyệt theo các tiêu chí dưới đây.

![Minh họa panel tối, focus và trạng thái chờ của hướng Saigon Soft-Future](./ui-criteria/saigon-soft-future.jpg)

_Minh họa dựng từ mô tả Style Direction 04 ở #415, trên nền cảnh mưa của [#259](./city-targets.md). Ảnh này dùng để định hướng. Nguồn ảnh gốc Style Direction 04 chưa được đính kèm trên GitHub._

| Mã  | Kết quả nhìn thấy                                                                    | Cách kiểm                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | Panel nền tối, chữ và hành động chính phân biệt rõ.                                  | Xem trực tiếp HUD, hộp tài khoản và hộp thoại trên cảnh tối có neon.                                                                              |
| N2  | Đổi màu tiệm giữ nguyên màu trạng thái, lỗi và focus.                                | Test `đổi accent tiệm không đổi màu trạng thái lỗi` ở #417 và xem bộ màu trong thư viện.                                                          |
| N3  | Màn hình dùng cùng thang chữ và khoảng cách.                                         | Đối chiếu token. Test `component không ghi mã màu và chỉ dùng biến đã khai` ở #417.                                                               |
| T1  | Mỗi vùng có một hành động chính, nhãn nêu việc sẽ xảy ra.                            | Kiểm nút chính, phụ và vị trí nhãn ở từng mẫu component.                                                                                          |
| T2  | Khi đang chờ, nút hiện trạng thái bận và mỗi lần gửi chỉ sinh một lệnh.              | Test `nút đang chờ không nhận lệnh và báo bận cho trình đọc màn hình` ở #418. Test `nhấn E hai lần khi đang chờ chỉ gửi một yêu cầu ngồi` ở #419. |
| T3  | Thành công, từ chối và lỗi kỹ thuật có phản hồi phân biệt được.                      | Chạy mẫu tương tác #419 với trả lời thành công, từ chối và mất kết nối.                                                                           |
| P1  | Khi tải không có số tiến độ giả, khung dữ liệu giữ kích thước ổn định.               | Test `spinner không hiện phần trăm khi không có tiến độ thật` ở #418. So bố cục skeleton trước và sau khi tải bằng trình duyệt.                   |
| P2  | Lỗi nằm cạnh vùng thao tác và nêu bước xử lý tiếp.                                   | Giả lập các lỗi tải hoặc từ chối trong thư viện. Đọc bằng thiết bị trợ năng.                                                                      |
| K1  | Dùng được bằng bàn phím và chạm. Focus nhìn rõ và quay về nơi mở khi đóng hộp thoại. | Smoke Chrome hộp đăng nhập ở #418. Duyệt Tab, Escape và kích thước vùng bấm ở viewport di động.                                                   |
| K2  | Chữ đạt 4,5:1 với mặt nền. Viền focus và dấu hiệu thành phần đạt 3:1.                | Chạy test tương phản chữ, viền focus và màu trạng thái ở #417. Xem thêm trong thư viện.                                                           |
| L1  | Hộp thoại phủ HUD. Lớp khôi phục có thể nhìn thấy cả khi đang có HUD hoặc hộp thoại. | Kiểm thứ tự lớp ở thư viện và smoke mất WebGL ở #419.                                                                                             |
| H1  | Chất lượng thấp và giảm trong suốt cho nền đặc.                                      | Test `mức chất lượng thấp dùng nền đặc thay kính` ở #417. Đổi mức chất lượng và tuỳ chọn trong thư viện.                                          |
| H2  | Bật giảm chuyển động thì không có chuyển động trang trí.                             | Test `khi người dùng chọn giảm chuyển động, mọi thời lượng về 0` ở #417.                                                                          |

## Bảng kiểm duyệt component

- [ ] Có biến thể và trạng thái trong [Thư viện giao diện](https://netverse3d.github.io/netverse3d/ui/) kèm mã tiêu chí áp dụng.
- [ ] Thao tác chính, phản hồi bận, thành công, từ chối và lỗi được kiểm theo T và P.
- [ ] Dùng được bằng phím và chạm. Focus và tương phản đạt K.
- [ ] Kiểm thứ tự lớp, nền đặc ở `low` và chế độ giảm chuyển động theo L, H.
- [ ] Thay đổi có ảnh chụp hoặc kịch bản thủ công cho phần nhìn. Tiêu chí tự động tương ứng chạy trong `pnpm verify`.
