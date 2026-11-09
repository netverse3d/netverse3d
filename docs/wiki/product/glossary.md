# Thuật ngữ

Dùng đúng các từ này trong tài liệu, issue và tên định danh.

| Tiếng Việt         | Trong mã         | Nghĩa                                                             |
| ------------------ | ---------------- | ----------------------------------------------------------------- |
| Thế giới           | `World`          | Không gian chung chứa các khu đất và tiệm                         |
| Khu đất            | `Land`           | Vị trí trong thế giới, được thuê để mở tiệm                       |
| Hợp đồng thuê đất  | `LandLease`      | Quyền dùng khu đất trong một thời hạn                             |
| Tiệm               | `Shop`           | Tiệm net của một chủ tiệm trên khu đất đã thuê                    |
| Chủ tiệm           | `Owner`          | Người thuê đất và vận hành tiệm                                   |
| Người chơi         | `Player`         | Người đi chơi net                                                 |
| Nhân vật           | `Avatar`         | Hình ảnh 3D của người dùng                                        |
| Máy                | `Station`        | Một máy tính trong tiệm                                           |
| Chỗ ngồi           | `Seat`           | Vị trí gắn với một máy, chỉ một người giữ tại một thời điểm       |
| Phiên dùng máy     | `StationSession` | Khoảng thời gian một người chơi dùng máy                          |
| Phòng              | `Room`           | Phiên realtime của một tiệm trên game server                      |
| Danh tiếng         | `Reputation`     | Chỉ số thể hiện mức độ thành công của tiệm                        |
| Asset              | `Asset`          | Tệp 3D, ảnh, âm thanh dùng trong thế giới                         |
| Xèng (tên tạm)     | `Credit`         | Tiền ảo nạp một chiều, chỉ tiêu trong Netverse                    |
| Điểm doanh thu     | `RevenuePoints`  | Điểm hệ thống cấp cho chủ tiệm khi tiệm có khách                  |
| Sổ cái             | `Ledger`         | Ghi kép mọi thay đổi số dư Xèng và điểm doanh thu                 |
| Block giờ máy      | `TimeBlock`      | Khoảng thời gian dùng máy trả trước                               |
| Màn hình máy       | `Desktop`        | Lớp 2D mở ra khi ngồi vào máy                                     |
| Màn hình chung     | `ShopScreen`     | Màn hình lớn của tiệm, đồng bộ bằng trạng thái                    |
| Game trên máy      | `StationGame`    | Game web của Netverse chơi trên màn hình máy                      |
| Bot                | `Bot`            | Nhân vật do máy điều khiển, bằng luật hoặc mô hình học tăng cường |
| Bot khách          | `GuestBot`       | Bot đóng vai khách trong tiệm vắng, luôn hiện rõ là bot           |
| Công thức nhân vật | `AvatarRecipe`   | Mã từng món đồ và màu, thứ duy nhất tài khoản lưu về ngoại hình   |
| Biểu cảm           | `Emote`          | Nét mặt đổi được khi chơi, không lưu trong công thức              |

## Thuật ngữ quy trình

| Từ             | Nghĩa                                                          |
| -------------- | -------------------------------------------------------------- |
| REQ            | Một yêu cầu đã ghi trong sổ yêu cầu                            |
| ADR            | Bản ghi một quyết định kiến trúc hoặc phạm vi                  |
| Lệch nghiệp vụ | Việc đang làm trái với REQ hoặc ADR, hoặc chưa có REQ nào phủ  |
| Promote        | Đưa `staging` lên `main`                                       |
| Hợp đồng       | Mô tả giao tiếp giữa các thành phần trong `packages/contracts` |
