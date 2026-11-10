# ADR-0002: Tiệm net là sản phẩm chính, AI làm sau

- Trạng thái: accepted
- Ngày: 2026-11-07
- Thứ tự giai đoạn đã được thay bằng [ADR-0013](./ADR-0013-vertical-slice-roadmap.md), chốt ngày 2026-11-10.
- Đang xem lại: phần học tăng cường và đấu trường theo [ADR-0012](./ADR-0012-games-for-rl-bots.md); phần "AI làm sau" theo [ADR-0014](./ADR-0014-saigon-cyber-and-own-characters.md). Trong lúc chờ chốt, độ ưu tiên của bot theo các bản đề xuất đó.

## Bối cảnh

Sơ đồ của mentor mô tả nền tảng tiệm net nhiều chủ kèm chatbot và TTS. Hai hội thoại mentor gửi sau nói về huấn luyện NPC bằng RL và đấu trường AI. Mentor xác nhận hướng dưới đây qua người dẫn dắt nhóm.

## Quyết định

- Sản phẩm chính: chủ tiệm thuê đất, xây và vận hành tiệm; người chơi chọn tiệm, vào máy, giao lưu.
- Sau đó: chatbot LLM và TTS tiếng Việt.
- Sau nữa: NPC RL, bắt đầu từ một NPC phục vụ trong quán.
- Đấu trường AI không nằm trong phạm vi.
- Trước mắt tập trung vào giao diện, identity, media, payment, notification.

## Hệ quả

- REQ của RL có độ ưu tiên `could` và nằm ở milestone muộn.
- Kiến trúc cần chừa chỗ cho NPC trong game server nhưng không xây trước.
