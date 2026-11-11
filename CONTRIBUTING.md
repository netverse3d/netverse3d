# Đóng góp

Repo này công khai để xem, nhưng chỉ nhận đóng góp từ thành viên nhóm. Mã không được cấp phép dùng lại, xem [LICENSE](LICENSE).

Tài liệu này là quy ước chung của nhóm về issue và pull request. Mục đích là mở bất kỳ việc nào ra cũng biết ai đang làm, làm gì, khi nào xong và đã xong bằng thay đổi nào.

Thành viên mới đọc thêm:

- [Ngày đầu tiên](docs/wiki/team/onboarding.md)
- [Luồng làm việc](docs/wiki/team/workflow.md)
- [Quy ước mã](docs/wiki/engineering/conventions.md)

## Một việc đi qua những bước nào

1. Có issue mô tả việc cần làm.
2. Một người nhận issue, điền ngày bắt đầu và hạn, chuyển sang `Ready` rồi `In Progress`.
3. Tạo nhánh từ `staging`: `feat/<issue>-<slug>`, `fix/<issue>-<slug>`, `docs/<slug>`, `chore/<slug>`.
4. Mở pull request vào `staging`, mô tả có `Closes #<issue>`.
5. Một thành viên khác duyệt, squash merge. Issue tự đóng khi PR được merge.

Không làm việc gì mà chưa có issue. Việc nhỏ cũng mở issue, mô tả ngắn cũng được, miễn đủ thông tin ở mục dưới.

## Thông tin bắt buộc của một issue

Các thông tin này nằm ở thanh bên phải của issue trên GitHub.

| Thông tin       | Ý nghĩa                                         | Phải có khi nào                |
| --------------- | ----------------------------------------------- | ------------------------------ |
| **Type**        | `Feature`, `Task` hoặc `Bug`                    | Lúc tạo                        |
| **Labels**      | Một nhãn `area:*` cho thành phần chịu ảnh hưởng | Lúc tạo                        |
| **Milestone**   | Giai đoạn mà việc này thuộc về                  | Lúc tạo                        |
| **Priority**    | Mức cần làm trước, xem thang bên dưới           | Lúc tạo                        |
| **Effort**      | Công sức ước lượng, xem thang bên dưới          | Lúc tạo                        |
| **Assignees**   | Người chịu trách nhiệm đưa việc tới lúc xong    | Trước khi chuyển sang `Ready`  |
| **Start date**  | Ngày bắt đầu làm                                | Trước khi chuyển sang `Ready`  |
| **Target date** | Ngày dự kiến PR được merge                      | Trước khi chuyển sang `Ready`  |
| **Status**      | Cột trong Project `Netverse 3D`                 | Cập nhật mỗi khi đổi giai đoạn |

Priority và Effort là field của issue. Hai field `Priority` và `Size` cũ trong Project không còn dùng.

### Loại issue

| Type      | Dùng khi                                                              |
| --------- | --------------------------------------------------------------------- |
| `Feature` | Một khả năng mới cho người dùng; thường là issue cha có các issue con |
| `Task`    | Một việc làm được trong vài ngày, kết thúc bằng một PR                |
| `Bug`     | Hành vi sai so với yêu cầu đã chốt                                    |

### Thang Priority

| Mức      | Nghĩa là                                                      |
| -------- | ------------------------------------------------------------- |
| `Urgent` | Đang chặn người khác hoặc làm hỏng `staging`; làm ngay        |
| `High`   | Cần cho mốc của milestone hiện tại                            |
| `Medium` | Nên có trong milestone hiện tại, lùi được nếu thiếu thời gian |
| `Low`    | Làm khi rảnh, không ảnh hưởng mốc nào                         |

### Thang Effort

| Mức      | Nghĩa là                                                    |
| -------- | ----------------------------------------------------------- |
| `Low`    | Xong trong một ngày                                         |
| `Medium` | Hai đến ba ngày                                             |
| `High`   | Hơn ba ngày; cân nhắc tách thành nhiều issue trước khi nhận |

Ước lượng sai thì sửa lại ngay trên issue. Con số đúng sau khi làm có ích hơn con số đẹp lúc đầu.

### Nhãn khác

| Nhãn             | Dùng khi                                        |
| ---------------- | ----------------------------------------------- |
| `needs-decision` | Còn câu hỏi nghiệp vụ phải chốt trước khi làm   |
| `blocked`        | Đang chờ một issue khác; ghi số issue đó ở thân |
| `waiting-mentor` | Đang chờ mentor trả lời                         |

## Thân issue

Không bắt theo một khuôn cứng, nhưng người đọc phải trả lời được bốn câu hỏi:

1. **Bối cảnh:** hiện đang thế nào, vì sao cần làm.
2. **Việc cần làm:** phạm vi, viết thành các gạch đầu dòng kiểm được.
3. **Xong khi nào:** cách kiểm là đã xong, người khác tự kiểm được.
4. **Yêu cầu liên quan:** mã REQ hoặc ADR. Việc thuần tài liệu, công cụ thì ghi "không".

Nên có thêm phần ngoài phạm vi, ảnh chụp hoặc đường dẫn tới chỗ mã liên quan nếu giúp người nhận bắt tay nhanh hơn.

Issue tạo tự động từ sổ yêu cầu có thể chưa đủ chi tiết. Người nhận bổ sung thân issue trước khi chuyển sang `Ready`.

## Trạng thái trong Project

| Status        | Nghĩa là                                         |
| ------------- | ------------------------------------------------ |
| `Backlog`     | Đã ghi nhận, chưa ai nhận                        |
| `Ready`       | Có người nhận, có ngày, thân issue đủ để bắt tay |
| `In Progress` | Đã có nhánh và đang làm                          |
| `In Review`   | Đã mở PR                                         |
| `Done`        | PR đã merge vào `staging`                        |

## Pull request

- Mỗi PR vào `staging` đóng đúng một issue bằng dòng `Closes #<issue>` trong mô tả. CI từ chối PR thiếu dòng này.
- Một issue một PR. Việc lớn hơn một PR thì tách thành issue con.
- PR đổi mã sản phẩm phải nêu REQ hoặc ADR đã chốt.
- Tiêu đề PR theo Conventional Commits bằng tiếng Anh; mô tả bằng tiếng Việt theo mẫu có sẵn.
- Chạy `pnpm verify` trước khi xin review.
- Squash merge. Nhánh tự xoá sau khi merge.

Không đóng issue bằng tay khi việc đã làm xong; để PR đóng. Chỉ đóng tay khi issue trùng hoặc không làm nữa: chọn `Close as not planned` và ghi lý do trong bình luận.

PR đưa `staging` lên `main` và PR cập nhật thư viện của Dependabot không cần issue.

## Ai chịu trách nhiệm gì

| Vai           | Trách nhiệm                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------- |
| Người nhận    | Giữ thông tin issue đúng với thực tế, mở PR, sửa theo góp ý, báo sớm khi trễ hạn hoặc bị chặn |
| Người duyệt   | Đọc mã, đối chiếu với mục "Xong khi nào" của issue và với REQ, ADR liên quan                  |
| Người dẫn dắt | Đặt Priority, giữ milestone, chốt câu hỏi nghiệp vụ, đưa `staging` lên `main`                 |

Một issue chỉ có một người nhận chính. Cần nhiều người thì tách issue.

Trễ hạn không phải lỗi; im lặng mới là vấn đề. Thấy không kịp thì sửa Target date và ghi một dòng lý do vào issue.

## Số liệu đóng góp

Thống kê đóng góp của từng thành viên được đọc từ issue đã đóng: người nhận, Effort, Milestone, nhãn `area:*` và PR đi kèm. Vì vậy:

- Việc đã làm mà không có issue thì không được tính.
- Issue không có người nhận hoặc không có Effort thì không quy được về ai và nặng bao nhiêu.
- Người duyệt PR cũng được ghi nhận qua lượt review trên PR.

## Khi việc đang làm lệch với yêu cầu

Dừng lại và hỏi, không tự chọn. Mở issue theo mẫu "Lệch nghiệp vụ hoặc câu hỏi cần chốt", ghi các lựa chọn và hệ quả. Chi tiết ở [luồng làm việc](docs/wiki/team/workflow.md).

## Những điều cấm

- Không commit secret, mã số sinh viên, dữ liệu thật của người dùng.
- Không đưa mã hoặc tài liệu từ dự án, tổ chức khác vào repo khi chưa có phép rõ ràng.
- Không đẩy thẳng lên `staging` hoặc `main`.
- Không tắt hoặc nới công cụ kiểm để cho qua.
