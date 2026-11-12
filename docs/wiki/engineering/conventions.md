# Quy ước

## Ngôn ngữ

| Nơi                                    | Ngôn ngữ          |
| -------------------------------------- | ----------------- |
| Tên định danh, chuỗi trong mã, commit  | Tiếng Anh         |
| Tài liệu, mô tả PR, issue, tên ca test | Tiếng Việt có dấu |

## Commit

Theo Conventional Commits, chỉ có tiêu đề và trailer, không có thân văn xuôi. Git hook kiểm tra khi commit.

```
feat: let owners rent land

Refs: REQ-009
```

Loại: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `style`, `revert`.

Tiêu đề nói thay đổi cho người đọc, không nói tên tệp hay tên hàm.

## Chú thích trong mã

- Không thêm chú thích mới.
- Khi sửa một hàm hoặc khai báo, xoá chú thích cũ trong đơn vị đó.
- Chỉ giữ chỉ dẫn cho công cụ: build tag, lint directive, migration marker, shebang.
- Kiến thức để trong tên định danh, tên test, wiki, ADR.

## Test

- Viết test nói được hành vi, tên ca test bằng tiếng Việt.
- Sửa lỗi thì viết test tái hiện lỗi trước.
- Luồng tiền, giữ máy, xác thực phải có test cho cả đường lỗi và đường chạy đồng thời.
- Test phải thấy đỏ ít nhất một lần trước khi xanh.

## Secret

- Không commit secret. `.env` không được track, `.env.example` chỉ có giá trị giả.
- Lỡ đẩy secret lên thì xoay vòng secret đó ngay, xoá khỏi mã là chưa đủ.
- Lịch sử git của repo public coi như đã lộ vĩnh viễn.

## Kiểm tra

| Lệnh                               | Việc                                |
| ---------------------------------- | ----------------------------------- |
| `pnpm verify`                      | Toàn bộ kiểm tra, mọi thành phần    |
| `pnpm verify:repo`                 | Phần kiểm chung của repo            |
| `pnpm catalog:check`               | Cấu trúc và chuẩn thành phần        |
| `pnpm boundaries:check`            | Hướng phụ thuộc giữa các lớp        |
| `pnpm trace:check`                 | Sổ yêu cầu và ADR                   |
| `pnpm trace:link REQ-001`          | Liên kết nhánh hiện tại với yêu cầu |
| `pnpm docs:generate`               | Sinh lại các trang từ dữ liệu       |
| `pnpm infra:up`, `pnpm infra:down` | Bật, tắt hạ tầng dev                |
| `pnpm infra:smoke`                 | Kiểm tra hạ tầng dev chạy đủ        |
