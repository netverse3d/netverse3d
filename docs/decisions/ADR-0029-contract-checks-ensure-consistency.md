# ADR-0029: Bước kiểm hợp đồng bảo đảm nhất quán, không chặn thay đổi

- Trạng thái: accepted
- Ngày: 2026-11-13
- Xem thêm: [ADR-0020](./ADR-0020-monorepo-layout-and-index.md), [ADR-0028](./ADR-0028-service-to-service-communication.md)

## Bối cảnh

[ADR-0020](./ADR-0020-monorepo-layout-and-index.md) ghi: thay đổi phá vỡ một hợp đồng thì phải mở thư mục phiên bản mới, và bước kiểm contracts chặn thay đổi phá vỡ ở hợp đồng không còn là nháp. Luật đó hợp với hợp đồng đã có bên dùng ở ngoài repo.

Thực tế hiện nay khác: hệ thống đang được dựng, hợp đồng đổi liên tục trong lúc code, và mọi bên dùng hợp đồng đều nằm trong repo này. Một cổng chặn chỉ buộc người làm tạo tệp phiên bản mới cho những thay đổi mà cả hai phía được sửa trong cùng một PR. Điều cần giữ không phải là hợp đồng đứng yên, mà là hợp đồng và mã luôn khớp nhau.

## Quyết định

1. Bước kiểm contracts không chặn thay đổi hợp đồng. Nó liệt kê các thay đổi so với nhánh gốc, gồm xoá trường, đổi kiểu, thêm trường bắt buộc, xoá endpoint hay xoá tệp, để người đọc PR thấy. Điều này áp cho hợp đồng HTTP, sự kiện, realtime, dữ liệu thế giới và gRPC, không phân biệt nháp hay chính thức.
2. Bước kiểm vẫn báo lỗi lúc bản thân hợp đồng sai: sai cú pháp, thiếu thông tin bắt buộc, đặt tên sai quy ước.
3. Nhất quán giữa hợp đồng và mã được giữ bằng build và test:
   - Kiểu của gRPC được sinh từ tệp `.proto`; bên phục vụ và bên gọi biên dịch với kiểu đó, nên đổi hợp đồng mà chưa sửa mã thì build đỏ.
   - Tài liệu HTTP công bố được so với bản service xuất ra.
   - Sự kiện được kiểm theo hợp đồng trước lúc phát.
4. Một luật kỹ thuật vẫn báo lỗi ở hợp đồng gRPC: không lấy số của một field đã bỏ để đặt cho một field khác kiểu. Xoá field thì tự do; dùng lại số làm dữ liệu cũ bị đọc sai một cách âm thầm, và build cùng test không bắt được.
5. Thư mục phiên bản `v<N>` của ADR-0020 vẫn giữ. Mở phiên bản mới là lựa chọn của người làm lúc cần hai bản chạy song song, không còn là điều bước kiểm đòi.

## Hệ quả

- Điểm về thay đổi phá vỡ trong ADR-0020 và điểm 13 của ADR-0028 được thay bằng ADR này.
- Trạng thái `x-status: draft` không còn ảnh hưởng tới bước kiểm; nó chỉ còn là thông tin cho người đọc.
- Các service được phát hành riêng theo ADR-0022, nên có lúc hai phiên bản của một hợp đồng cùng chạy. Bước kiểm ở PR không bảo vệ trường hợp đó. Lúc có bên dùng ngoài repo, hoặc lúc phát hành production thật, cần thêm bước so hợp đồng của bản sắp lên với bản đang chạy; việc đó chưa làm.
- Người duyệt PR phải đọc danh sách thay đổi hợp đồng mà bước kiểm in ra.
