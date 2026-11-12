# ADR-0022: Phát hành theo từng thành phần, mỗi thành phần một dòng tag

- Trạng thái: accepted
- Ngày: 2026-11-12
- Thay phần tag của: [ADR-0007](./ADR-0007-branching-and-release.md)
- Xem thêm: [ADR-0020](./ADR-0020-monorepo-layout-and-index.md)

## Bối cảnh

[ADR-0007](./ADR-0007-branching-and-release.md) dùng một dòng tag cho cả hệ thống, `stg-vX.Y.Z` và `prod-vX.Y.Z`, và chỉ nhận tag production khi toàn bộ repo giống hệt tag staging cùng số. Cách này có hai hệ quả khi số service tăng:

- Sửa gấp một service phải mang theo mọi thay đổi đang có trên `staging` của các service khác, kể cả việc chưa xong. ADR-0007 yêu cầu ẩn việc chưa xong sau cờ tính năng, nhưng đó là kỷ luật, không phải cơ chế.
- Một số phiên bản chung không nói được thành phần nào thật sự đổi trong bản đó.

Repo chưa phát hành tag nào, nên đổi dạng tag lúc này không phải chuyển đổi gì.

Người dẫn dắt nhóm chốt ngày 2026-11-12, theo [REQ-027](../requirements/registry.yaml): mỗi thành phần triển khai có dòng tag riêng, để lỗi ở thành phần nào thì sửa và đưa đúng thành phần đó lên.

## Quyết định

### Phần của ADR-0007 còn hiệu lực

- `staging` là nhánh mặc định và môi trường test; `main` là production.
- PR việc squash vào `staging`; `staging` lên `main` bằng merge commit.
- Tag chỉ do workflow Release tạo qua GitHub App; tag không sửa, không xoá; production cần một thành viên khác duyệt.
- Production dùng lại image đã test ở staging, không build lại. Không tìm thấy image đúng nội dung thì phát hành thất bại.
- Sửa gấp là một `fix` đi qua `staging`.

### Phần thay đổi

1. Mỗi thành phần triển khai được có dòng phiên bản và dòng tag riêng: `<id>/stg-vX.Y.Z` và `<id>/prod-vX.Y.Z`, với `<id>` là mã thành phần trong `docs/catalog.yaml`. Ví dụ `identity/stg-v1.2.0`. Image của thành phần mang tag `X.Y.Z`.
2. Thành phần triển khai được là thành phần có `Dockerfile`. Package dùng chung không có tag; thay đổi của nó đi theo thành phần dùng nó.
3. Số phiên bản mới phải lớn hơn tag trước đó của chính thành phần ấy. Test lại trên staging thì tăng Z; production dùng đúng số của bản staging đã đạt.
4. Tag `<id>/prod-vX.Y.Z` hợp lệ khi nằm trên `main`, đã có `<id>/stg-vX.Y.Z`, và nội dung của thành phần đó giống tag staging. Nội dung của một thành phần gồm thư mục của nó, các package nó phụ thuộc và các tệp gốc dùng chung. Phần còn lại của repo không tham gia phép so.
5. Phụ thuộc giữa các thành phần được khai một nơi, đọc từ manifest của thành phần hoặc từ catalog, và công cụ phát hành dùng đúng nơi đó.
6. Mỗi lần phát hành ghi lại bảng trạng thái môi trường: thành phần nào đang chạy phiên bản nào, image nào, từ commit nào. Bảng này là căn cứ về bản đang chạy, vì mã trên `main` có thể mới hơn bản đang chạy của một thành phần.
7. Lùi một thành phần là đưa lại phiên bản trước của riêng nó theo bảng trạng thái; các thành phần khác không đổi.
8. Các phiên bản chạy được với nhau nhờ hợp đồng có phiên bản và luật sau: thay đổi schema và hợp đồng phải chạy được với bản liền trước của bên còn lại.

## Hệ quả

- Việc chưa xong của một thành phần có lên `main` cũng không lên production cho tới lúc chính thành phần đó được phát hành. Cờ tính năng vẫn cần cho việc chưa xong nằm trong cùng một thành phần hoặc trong package dùng chung.
- Mã trên `main` và bản đang chạy có thể lệch nhau theo từng thành phần. Người tìm lỗi phải xem bảng trạng thái, không suy từ nhánh.
- Số tag nhiều hơn và nhóm phải tự biết bộ phiên bản nào đã được test cùng nhau; kiểm đầu cuối ở staging chạy với các thành phần khác ở phiên bản staging hiện hành.
- Công cụ phát hành, ba workflow, luật bảo vệ tag, Environment trên GitHub và runbook phải đổi theo dạng tag mới. Cho tới lúc đổi xong thì chưa phát hành tag nào.
- Luật bảo vệ tag trên GitHub đổi mẫu từ `stg-v*`, `prod-v*` sang mẫu có mã thành phần. Đây là thay đổi cấu hình ngoài repo và phải áp cùng lúc với workflow.
