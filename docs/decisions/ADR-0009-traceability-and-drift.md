# ADR-0009: Truy vết yêu cầu và hỏi lại khi lệch

- Trạng thái: accepted
- Ngày: 2026-11-07

## Bối cảnh

Các nguồn yêu cầu mâu thuẫn nhau và mỗi thành viên dùng một công cụ AI khác nhau. Nếu không có bước kiểm, tài liệu và mã sẽ lệch nhau rất nhanh. GitHub không hiện được hộp thoại cho người đang làm, nên việc hỏi phải xảy ra ở nhiều lớp.

## Quyết định

Mỗi yêu cầu có mã `REQ-xxx` trong `docs/requirements/registry.yaml`, mỗi quyết định có mã `ADR-xxxx`. Ba lớp kiểm:

1. **Công cụ AI:** tệp quy tắc chung ở gốc repo yêu cầu dừng và hỏi; công cụ hỗ trợ hook thì hiện hộp thoại xác nhận.
2. **Git hook:** `pre-push` hỏi xác nhận trên terminal khi đổi mã sản phẩm mà chưa gắn yêu cầu.
3. **CI:** đổi mã sản phẩm mà PR không có REQ hoặc ADR và issue thì không merge được.

## Hệ quả

- Hai lớp đầu giúp phát hiện sớm nhưng có thể bị bỏ qua; lớp CI là lớp bắt buộc.
- CI chỉ kiểm việc có gắn yêu cầu hay không, không phán đoán được mã có đúng yêu cầu hay không. Phần đó thuộc về review.
- REQ `draft` chỉ gây cảnh báo; REQ đã bỏ hoặc không tồn tại thì bị chặn.
