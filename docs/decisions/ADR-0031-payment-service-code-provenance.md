# ADR-0031: Nguồn gốc mã payment gateway

- Trạng thái: accepted
- Ngày: 2026-11-14
- Xem thêm: [ADR-0005](./ADR-0005-public-repository.md), [ADR-0020](./ADR-0020-monorepo-layout-and-index.md), [ADR-0021](./ADR-0021-two-real-money-flows.md)

## Bối cảnh

`services/payment` mới chỉ là chỗ giữ. Người dẫn dắt nhóm đã có payment gateway chạy trong QIZHUB và một bản được chuẩn hoá theo bộ service-suite. Netverse là repo public, nên cần chốt quyền và nguồn gốc trước khi nhập bất kỳ mã nào theo ADR-0005.

## Quyết định

### Nguồn gốc mã

1. Ứng viên nhập là bản chuẩn hoá `baodhg/payment-gateway-service` tại commit `6d5d147fba0c1789e250c4f14b12d1338769c7b3`. Dòng mã bắt nguồn từ `baodhg/payment-service`; production upstream tại lúc lập quyết định là `f3976f8eef7112092836ea2060df6f6c755f203c`.
2. Repo chuẩn hoá bắt đầu từ commit gốc không có parent; lịch sử Git upstream không được mang vào monorepo. Manifest và hồ sơ nhập phải giữ cả SHA upstream lẫn SHA bản chuẩn hoá. Từng tệp được soát trước khi nhập để không bỏ sót hardening đã có ở production.
3. Người cho phép là chủ sở hữu mã, cũng là người dẫn dắt nhóm. Người đó xác nhận ngày 2026-11-14 rằng mã trong toàn bộ dòng payment-service và payment-gateway-service thuộc quyền của mình và được phép tái sử dụng trong repo Netverse public. Bằng chứng là xác nhận trong hội thoại lập quyết định này; phạm vi là repo Netverse.
4. `services/payment/component.yaml` ghi `provenance: cleared` và trỏ tới ADR này. Trước khi nhập, bản chụp phải qua quét secret và rà soát giấy phép phụ thuộc.
5. ADR này chỉ ghi quyền và nguồn gốc mã; không chốt thay các REQ payment còn ở trạng thái draft, giá/tỷ giá, chu kỳ license, hay chế độ PayOS production.

## Hệ quả

- Có thể nhập bản chuẩn hoá sau khi hoàn tất soát nguồn và runbook nhận service.
- Mọi thay đổi sau khi nhập phát triển trong monorepo Netverse; không nhập lại lịch sử repo nguồn.
- Gateway không thay thế sổ cái Xèng, entitlement license, hay các hợp đồng service-to-service của Netverse.
