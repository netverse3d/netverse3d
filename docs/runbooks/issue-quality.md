# Runbook chất lượng issue

## Tạo và sửa issue

1. Chọn mẫu phù hợp: Feature, Task, Bug hoặc mẫu chuyên biệt.
2. Điền các trường bắt buộc trong form: area, Milestone, Priority; điền Effort với Task và Bug. Feature không cần Effort.
3. Hoàn thành các ô bối cảnh và điều kiện hoàn tất trong thân issue.
4. Khi issue được tạo hoặc sửa, workflow `issue-quality` kiểm tra nội dung rồi đồng bộ Type, nhãn `area:*`, Milestone, Priority và Effort vào issue.

Workflow dùng `GITHUB_TOKEN` với `contents: read` và `issues: write`. Workflow kiểm tra PR chỉ cần `contents: read` và `issues: read`. Không cấp thêm quyền cho hai workflow này.

## Xử lý `needs-triage`

Nhãn này nghĩa là form thiếu metadata hoặc có lựa chọn không được hỗ trợ. Xem lỗi của lần chạy `issue-quality` trong tab Actions, sửa câu trả lời tương ứng trong thân issue rồi lưu issue để sự kiện `edited` chạy lại. Khi dữ liệu hợp lệ, workflow đồng bộ metadata và gỡ `needs-triage`. Không tự đoán hoặc tự điền Priority, Effort thay người tạo issue.

PR có `Closes #<issue>` bị kiểm tra metadata. CI chặn PR nếu issue thiếu Type, một nhãn area, Milestone, Priority hoặc Effort bắt buộc, hoặc còn `needs-triage`. Assignees, Start date và Target date cũng phải có để issue sẵn sàng đóng qua PR.

## Audit issue đang mở

Chạy tại thư mục gốc với `GH_TOKEN` có quyền đọc issue và giá trị field của repo:

```sh
pnpm issues:audit
```

Lệnh mặc định chỉ đọc. Báo cáo liệt kê lỗi từng issue đang mở, số issue lỗi và preview các thay đổi nhãn `needs-triage`. Nó không điền hoặc sửa Type, Milestone, Priority, Effort, Assignee hay ngày.

Đọc preview và xử lý nội dung issue trước. Chỉ sau khi người phụ trách đã duyệt các thay đổi nhãn mới chạy chế độ ghi:

```sh
pnpm issues:audit --apply
```

Chế độ này áp dụng đúng các thay đổi nhãn trong preview: thêm `needs-triage` cho issue thiếu metadata, hoặc gỡ nhãn đó khi metadata hiện đã đủ. Nó không tự sửa các giá trị metadata. Sau đó chạy lại `pnpm issues:audit` để xác nhận báo cáo; sửa nội dung issue cần xử lý theo hướng dẫn ở phần trên.
