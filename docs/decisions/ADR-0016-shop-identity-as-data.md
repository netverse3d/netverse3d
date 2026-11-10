# ADR-0016: Bản sắc tiệm là dữ liệu, mô hình không mang màu cố định

- Trạng thái: proposed
- Ngày: 2026-11-09
- Thay phần màu môi trường trong [ADR-0014](./ADR-0014-saigon-cyber-and-own-characters.md)

## Bối cảnh

Một con phố có nhiều tiệm, mỗi tiệm cần một bản sắc riêng. Bàn máy hiện là một khối với bảy vật liệu màu cố định, nên muốn đổi màu hay đổi kiểu bàn phím thì phải xuất lại mô hình. Làm vậy không đi tới được hàng trăm tiệm.

Bản thử trên bàn máy thật cho thấy một tệp GLB hiện được bốn bộ màu khác nhau, kể cả bàn phím gradient từng phím. Số tam giác giữ nguyên, số vật liệu giảm từ bảy xuống hai.

## Quyết định

- Mô hình môi trường và đồ đạc không mang màu cố định. Mỗi bề mặt trỏ vào một hàng trong dải màu qua UV. Hàng có một màu hoặc một gradient.
- Dải màu được dựng lúc chạy từ dữ liệu. Không vẽ tay texture cho từng tiệm.
- Vật liệu chỉ có `surface` và `glow` cho bề mặt, cùng hai vật liệu ảnh `display` và `decal` cho màn hình và logo.
- Đồ đạc chia thành các ô đồ: bàn, màn hình, bàn phím, chuột, ghế, thùng máy. Mỗi ô có nhiều biến thể khác hình dáng và lắp vào điểm gắn `socket_*`.
- Lúc chạy, các món của cùng một công thức được gộp hoặc instancing, để nguồn tách rời mà số lời gọi vẽ không tăng theo số máy.
- Điểm tương tác, chỗ ngồi và va chạm là Empty trong tệp Blender, tên `interact_point`, `seat_anchor`, `collision_*`.
- Mỗi tiệm có một công thức `shop-look`: bộ màu, biến thể theo ô, bố cục, biển hiệu, kiểu đèn.
- Tím neon hay tối trầm chỉ là các bộ màu. Bối cảnh đường phố sẽ chốt sau.

## Hệ quả

- Tiệm mới gần như không tốn thêm dung lượng tải.
- Chế độ chủ tiệm tự chỉnh ở M4 chỉ là sửa công thức.
- Người làm Blender phải theo hợp đồng về vật liệu, hàng màu, điểm gắn và khung kích thước. Công cụ kiểm tài sản sẽ chặn phần sai.
- Nhân vật chưa thuộc hệ này. Tuỳ biến nhân vật làm sau lát cắt đầu.
- Chưa đo đổi hình dáng theo ô đồ, độ nhám theo từng hàng màu và 50 máy trên GPU thật.

Liên quan: REQ-013, REQ-036, REQ-039, REQ-040, [ADR-0013](./ADR-0013-vertical-slice-roadmap.md), [ADR-0015](./ADR-0015-blender-sources-as-master.md).
