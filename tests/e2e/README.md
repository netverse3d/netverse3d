# e2e

Kiểm đầu cuối trên cả hệ: dựng các service bằng `infra/compose`, đi qua cổng vào và chạy một luồng nghiệp vụ trọn vẹn, ví dụ đăng ký, mở tiệm, trả tiền, vào phòng.

- Chạy ở bước phát hành staging, không chạy ở mỗi PR.
- Mỗi thành phần chạy ở phiên bản staging hiện hành của nó, theo [ADR-0022](../../docs/decisions/ADR-0022-per-component-release-tags.md).
- `stack-smoke.mjs` là kịch bản đầu tiên: đăng ký và đăng nhập ở `identity`, rồi tải lên và tải về ở `media` bằng token đó. Cách chạy ở [runbook](../../docs/runbooks/stack-smoke.md).
