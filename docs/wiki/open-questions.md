# Câu hỏi mở

Những điều chưa chốt. Có câu trả lời thì cập nhật REQ hoặc thêm ADR, rồi xoá dòng ở đây.

| #   | Câu hỏi                                                                                                                                                            | Ai trả lời   | Ảnh hưởng                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | -------------------------------------------------------- |
| 1   | Game core khi nào bàn giao, viết bằng Go hay Colyseus?                                                                                                             | Mentor       | REQ-017 đến REQ-021, `services/game`, giao thức realtime |
| 2   | Thanh toán dùng tiền thật hay chỉ môi trường thử khi bảo vệ? PayOS có môi trường thử hay không cần xác minh.                                                       | Mentor, nhóm | REQ-010, REQ-011, tài khoản PayOS                        |
| 3   | Thuê đất, thuê máy trả bằng tiền thật hay đơn vị trong game?                                                                                                       | Mentor, nhóm | REQ-009, REQ-011, luồng kinh tế                          |
| 4   | Phút chơi, tặng phút trong demo có giữ lại không?                                                                                                                  | Mentor       | REQ-011                                                  |
| 5   | Voice, nhạc chung, tranh treo tường, trình duyệt trên máy ảo có thuộc phạm vi không?                                                                               | Mentor       | Thêm REQ mới cho REQ-020 và `services/media`             |
| 6   | Sức chứa mục tiêu: 50, 100 hay 500 máy mỗi tiệm? Các nguồn đang ghi khác nhau.                                                                                     | Mentor       | REQ-019, thiết kế game server                            |
| 7   | Ai trả chi phí server và GPU cho LLM local?                                                                                                                        | Nhóm, mentor | REQ-022, REQ-023, REQ-026                                |
| 8   | Nhà trường yêu cầu tài liệu và mốc bảo vệ nào, ngày cụ thể ra sao?                                                                                                 | Nhóm         | Ngày của Milestone                                       |
| 9   | Ai phụ trách mảng nào trong nhóm?                                                                                                                                  | Nhóm         | CODEOWNERS, gán issue                                    |
| 10  | Object storage dùng gì? Sơ đồ ghi MinIO, nhưng bản cộng đồng đã ngừng và image chính thức không còn tải được. Các lựa chọn: RustFS, bản fork của MinIO, SeaweedFS. | Nhóm, mentor | REQ-006, `services/media`, `infra/compose`               |
