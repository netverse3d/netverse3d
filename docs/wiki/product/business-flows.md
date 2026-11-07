# Luồng nghiệp vụ

Các luồng dưới đây mô tả hành vi mong muốn. Điểm chưa chốt được đánh dấu và có trong [câu hỏi mở](../open-questions.md).

## Chủ tiệm mở tiệm

Liên quan: REQ-009, REQ-010, REQ-013, REQ-015, REQ-016.

```mermaid
flowchart TD
  A[Đăng nhập] --> B[Xem bản đồ đất trống]
  B --> C[Chọn khu đất và thời hạn thuê]
  C --> D[Thanh toán]
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

Chưa chốt: thuê đất trả bằng tiền thật hay đơn vị trong game; hết hạn thuê thì tiệm xử lý ra sao.

## Người chơi đi net

Liên quan: REQ-001, REQ-003, REQ-011, REQ-014, REQ-017, REQ-018, REQ-020.

```mermaid
flowchart TD
  A[Đăng nhập, tạo nhân vật] --> B[Khám phá danh sách tiệm]
  B --> C[Chọn tiệm bất kỳ]
  C --> D[Vào tiệm, di chuyển]
  D --> E[Đến gần máy, yêu cầu ngồi]
  E --> F{Máy còn trống và đủ điều kiện?}
  F -->|Có| G[Giữ máy cho người này]
  F -->|Không| D
  G --> H[Dùng máy: chơi, chatbot, giao lưu]
  H --> I{Còn thời gian?}
  I -->|Còn| H
  I -->|Hết| J[Gia hạn hoặc rời máy]
  J --> D
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

## Thanh toán

Liên quan: REQ-010, REQ-012. Webhook có thể đến nhiều lần hoặc không theo thứ tự.

```mermaid
sequenceDiagram
  participant U as Người dùng
  participant P as Payment service
  participant O as PayOS
  participant C as Core API
  U->>P: Tạo yêu cầu thanh toán
  P->>O: Tạo link thanh toán
  O-->>U: Trang thanh toán
  O->>P: Webhook kết quả
  P->>P: Xác thực chữ ký, bỏ qua nếu đã xử lý
  P->>C: Sự kiện thanh toán thành công
  C->>C: Cấp quyền thuê đất hoặc thuê máy
```
