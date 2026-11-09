# ADR-0012: Game trên máy do nhóm làm, bot học tăng cường chơi cùng người

- Trạng thái: proposed
- Ngày: 2026-11-08

## Bối cảnh

[ADR-0002](./ADR-0002-product-scope.md) để học tăng cường ở giai đoạn sau và loại đấu trường AI khỏi phạm vi. Mentor gợi ý thêm: dựng game web cho bot học tăng cường, tích hợp vào Netverse để đưa bot đã huấn luyện ra chơi.

Sổ yêu cầu cũng chưa trả lời người chơi ngồi vào máy để làm gì. Game do nhóm làm, có bot chơi cùng, trả lời câu này và giúp tiệm mới không vắng.

## Quyết định

- Nhóm tự thiết kế game web. Cùng thể loại với game có sẵn thì được, không sao chép tên, nhân vật, hình ảnh.
- Luật mỗi game viết một lần dưới dạng bước tất định: trạng thái, hành động và seed cho ra trạng thái mới. Giao diện chỉ hiển thị. Huấn luyện và chấm điểm dùng đúng bộ luật đó.
- Game đầu tiên làm ở M2 và được thiết kế sẵn để huấn luyện được.
- Mô phỏng headless, huấn luyện, kiểm định và chạy bot nằm ở `workers/ai`. Không thêm service.
- Mô hình xuất ra định dạng chạy được ngoài môi trường huấn luyện, ví dụ ONNX. Trận xếp hạng chạy bot trên server.
- Bot luôn hiện rõ là bot. Điểm doanh thu từ bot khách theo giới hạn ở [ADR-0010](./ADR-0010-one-way-virtual-currency.md).
- Nếu được chốt, quyết định này thay phần học tăng cường và đấu trường trong ADR-0002. Nền tảng cho người dùng tự nộp mã bot vẫn ngoài phạm vi.

## Hệ quả

- Kéo học tăng cường lên M6, trước chatbot.
- Mentor có thể huấn luyện song song từ M2.
- Còn mở: thể loại game đầu tiên, ngôn ngữ viết luật, bộ công cụ huấn luyện. Chat của mentor nhắc Python, Gymnasium, PettingZoo và PPO.
- Nếu luật viết bằng Python thì server chạy trận, giao diện chỉ hiển thị; hợp với game theo lượt hoặc nhịp chậm.

Liên quan: REQ-033, REQ-035, REQ-038.
