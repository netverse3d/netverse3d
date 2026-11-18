# ADR-0036: Gộp PR theo tiêu chí issue và pipeline, không bắt approval

- Trạng thái: accepted
- Ngày: 2026-11-18
- Xem thêm: [ADR-0007](./ADR-0007-branching-and-release.md), [ADR-0009](./ADR-0009-traceability-and-drift.md)

## Bối cảnh

Nhóm cần giữ issue và pipeline làm căn cứ thống nhất để đưa thay đổi vào nhánh dùng chung. Approval PR không phải bước bắt buộc của quy trình. Cấu hình và tài liệu cũ còn gửi review request cho một người, buộc giải quyết thread và dự định bật approval khi có thêm thành viên.

## Quyết định

- PR công việc vào `staging` phải liên kết issue có REQ hoặc ADR. Người merge xác nhận tiêu chí trong mục Xong khi nào của issue đã đạt, nội dung đáp ứng yêu cầu liên kết và toàn bộ check bắt buộc xanh.
- PR promote `staging` lên `main` vẫn phải qua PR và đạt điều kiện phát hành theo ADR-0007; giữ ngoại lệ hiện có về issue và REQ.
- PR công việc vào `staging` và PR promote lên `main` đều không cần approval. Review, comment và review thread là tùy chọn; không yêu cầu code owner hay người duyệt commit cuối.
- Các check `verify`, `trace`, `secrets` vẫn bắt buộc do GitHub Actions tạo. `staging` chỉ nhận squash; `main` chỉ nhận merge commit từ `staging`. Không ai được bypass ruleset.
- Thành viên muốn góp ý tùy chọn dùng trạng thái `COMMENT`. Nếu có review `CHANGES_REQUESTED` làm PR bị chặn, người merge kiểm tra tiêu chí issue hoặc điều kiện promote cùng pipeline rồi dismiss review đó khi PR đủ điều kiện; không yêu cầu reviewer approve.
- Approval của Environment `production-release` vẫn bắt buộc trước khi tạo tag production theo ADR-0007.

## Hệ quả

- Việc thiếu reviewer không còn giữ PR công việc lại khi tiêu chí issue và pipeline đã đạt, cũng không giữ PR promote lại khi điều kiện phát hành và checks đã đạt.
- Chất lượng chức năng được đối chiếu với mục Xong khi nào của issue bởi người merge; review chéo vẫn có thể giúp nhưng không chặn việc merge.
- Một review `CHANGES_REQUESTED` cần được dismiss nếu vẫn giữ quy tắc bắt buộc thay đổi đi qua PR của GitHub.
- Việc đưa mã lên production vẫn qua approval của lần phát hành, tách biệt với PR.
