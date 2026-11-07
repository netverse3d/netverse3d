# ADR-0005: Repo công khai, giữ bản quyền, kiểm soát nguồn gốc mã

- Trạng thái: accepted
- Ngày: 2026-11-07

## Bối cảnh

Trên gói GitHub Free của tổ chức, repo private không dùng được ruleset, nên không ép được quy trình. Repo public thì dùng được miễn phí.

## Quyết định

- Repo public, license All rights reserved: người khác được xem, không được dùng lại.
- Bật secret scanning và push protection; CI quét lịch sử bằng gitleaks và quét từ cấm.
- Không commit secret, mã số sinh viên, dữ liệu thật của người dùng, nguyên văn nội dung riêng của mentor.
- Mã có nguồn ngoài chỉ vào repo khi có phép rõ ràng, khai trong `component.yaml` và trỏ tới một ADR.

## Hệ quả

- Nội dung đã public không thu hồi được trọn vẹn, nên mọi lớp quét chạy trước khi merge.
- Thành viên phải cân nhắc trước khi đưa bất kỳ mã có sẵn nào vào repo.
