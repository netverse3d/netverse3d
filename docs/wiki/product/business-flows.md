# Luồng nghiệp vụ

Các luồng dưới đây mô tả hành vi mong muốn. Điểm chưa chốt được đánh dấu và có trong [câu hỏi mở](../open-questions.md).

## Chủ tiệm mở tiệm

Liên quan: REQ-009, REQ-010, REQ-013, REQ-015, REQ-016.

```mermaid
flowchart TD
  A[Đăng nhập] --> B[Xem bản đồ đất trống]
  B --> C[Chọn khu đất và thời hạn thuê]
  C --> D[Trả bằng điểm doanh thu]
  D -->|Thành công| E[Đất thuộc quyền thuê của chủ tiệm]
  D -->|Thất bại| B
  E --> F[Chế độ xây dựng: đặt máy, bàn ghế, trang trí]
  F --> G[Gửi mở tiệm]
  G --> H{Quản trị viên duyệt}
  H -->|Đạt| I[Tiệm xuất hiện trong danh sách]
  H -->|Không đạt| F
  I --> J[Gần hết hạn thuê: nhắc gia hạn]
  J --> C
```

Hướng tạm theo [ADR-0010](../../decisions/ADR-0010-one-way-virtual-currency.md): thuê đất trả bằng điểm doanh thu. Chưa chốt:

- Chủ tiệm mới chưa có điểm thì thuê khu đất đầu tiên bằng gì.
- Hết hạn thuê khi tiệm đang có người thì xử lý ra sao.

## Người chơi đi net

Liên quan: REQ-001, REQ-003, REQ-011, REQ-014, REQ-017, REQ-018, REQ-020, REQ-032, REQ-033, REQ-036.

```mermaid
flowchart TD
  A[Đăng nhập, tạo nhân vật] --> B[Khám phá danh sách tiệm]
  B --> C[Chọn tiệm bất kỳ]
  C --> D[Vào tiệm, di chuyển]
  D --> E[Đến gần máy, yêu cầu ngồi]
  E --> F{Máy còn trống và đủ điều kiện?}
  F -->|Có| G[Giữ máy, trả block giờ máy bằng Xèng]
  F -->|Không| D
  G --> H[Màn hình máy: game, trình duyệt nhúng, video]
  H --> I{Còn thời gian trong block?}
  I -->|Còn| H
  I -->|Hết| J[Trả block tiếp hoặc rời máy]
  J -->|Trả tiếp| H
  J -->|Rời máy| D
  D --> K[Rời tiệm]
```

## Giữ máy khi nhiều người tranh

Liên quan: REQ-018. Đây là quy tắc không được hỏng: một máy chỉ có một người dùng tại một thời điểm.

```mermaid
sequenceDiagram
  participant A as Người chơi A
  participant B as Người chơi B
  participant G as Game server
  A->>G: seat.request máy 12
  B->>G: seat.request máy 12
  G->>G: Xử lý tuần tự trong phòng
  G-->>A: seat.granted
  G-->>B: seat.denied, lý do occupied
```

## Nạp Xèng

Liên quan: REQ-010, REQ-012, REQ-028, REQ-029. Webhook có thể đến nhiều lần hoặc không theo thứ tự. PayOS chỉ dùng để nạp; không có luồng rút.

```mermaid
sequenceDiagram
  participant U as Người dùng
  participant P as Payment service
  participant O as PayOS
  U->>P: Tạo đơn nạp Xèng
  P->>O: Tạo link thanh toán
  O-->>U: Trang thanh toán
  O->>P: Webhook kết quả
  P->>P: Xác thực chữ ký, bỏ qua nếu mã đơn đã xử lý
  P->>P: Ghi sổ cái: cộng Xèng
  P-->>U: Thông báo số dư mới
```

## Trả giờ máy và cấp điểm doanh thu

Liên quan: REQ-011, REQ-029, REQ-030. Xèng của người chơi không bao giờ vào ví chủ tiệm. Trừ Xèng là gọi đồng bộ vì phải biết kết quả trước khi cấp block; cấp điểm doanh thu đi qua sự kiện và có từ M4.

```mermaid
sequenceDiagram
  participant G as Game server
  participant C as Shop
  participant P as Payment service
  participant K as Kafka
  G->>C: Người chơi xin block giờ máy ở máy 12
  C->>P: Trừ Xèng theo giá của tiệm
  P->>P: Ghi sổ cái: trừ Xèng của người chơi, huỷ
  P-->>C: Đã trừ
  C-->>G: Cấp block, hết hạn lúc T
  C->>K: Sự kiện block giờ máy đã trả
  K->>P: Cấp điểm doanh thu cho chủ tiệm theo tỷ lệ (từ M4)
  P->>P: Ghi sổ cái: cộng điểm doanh thu
```
