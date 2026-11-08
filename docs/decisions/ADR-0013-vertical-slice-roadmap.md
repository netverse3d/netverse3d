# ADR-0013: Lộ trình theo lát cắt chạy được, room server giả trong lúc chờ core

- Trạng thái: proposed
- Ngày: 2026-11-08

## Bối cảnh

Lộ trình cũ có phụ thuộc ngược:

- Thuê đất ở M3 cần bản đồ của `world` ở M4.
- Thuê máy ở M3 cần máy ở M4 và chỗ ngồi ở M5.
- M5 chờ core của mentor, chưa có ngày.

Vì vậy nhiều REQ không thể nghiệm thu ở milestone của chính nó.

## Quyết định

- Mỗi milestone là một bản chạy được từ đầu tới cuối và chỉ phụ thuộc milestone trước:
  - M2: lát cắt đầu.
  - M3: Xèng và payment.
  - M4: chủ tiệm.
  - M5: ghép core.
  - M6: bot học tăng cường.
  - M7: chatbot, TTS và NPC.
  - M8: production.
- M2 dùng một room server giả theo giao thức nháp trong `packages/contracts/realtime`. Bản giả chỉ phục vụ phát triển và test giao diện, không triển khai lên staging hay production, không nằm ở `services/game`.

## Hệ quả

- Không trái [ADR-0004](./ADR-0004-game-core-boundary.md): nhóm không viết game server thật, chỉ có bản giả để test.
- REQ-017 và REQ-018 vẫn chỉ được nghiệm thu khi có core của mentor ở M5.
- Core tới sớm thì kéo M5 lên.
- Milestone trên GitHub được đổi tên theo mã `Mx`, issue giữ nguyên số.

Liên quan: REQ-017, REQ-018, REQ-032, REQ-033.
