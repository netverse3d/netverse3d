# Tài sản 3D

Nhân vật và đồ vật nằm ở `packages/game-assets`. Lý do chọn cách làm này ở [ADR-0015](../../decisions/ADR-0015-blender-sources-as-master.md).

## Xem những gì đã có

[Thư viện 3D](https://netverse3d.github.io/netverse3d/game-assets/library/) cho xem nhân vật với 24 hành động, 12 biểu cảm, bản có và không phụ kiện, con hẻm Sài Gòn, bộ sưu tập các hướng đã thử và tiệm mẫu. Xem tại máy bằng `pnpm assets:library`, rồi mở `http://localhost:4173/library/`. Máy cần có mạng vì trang tải three.js và phông chữ từ CDN.

Tab Hành động dùng đúng mô hình trong `exported/`, nên xuất xong tải lại trang là thấy. Các tab khác là bản phác để chốt hướng, gồm hình khối dựng bằng mã và hai mô hình thử nghiệm trong `library/models/`, chưa phải tài sản chính thức. Thư viện chỉ để xem; game thật sẽ viết trong `apps/web-3d`.

## Bốn nguyên tắc

1. Tệp `.blend` trong `source/` là bản gốc. Mọi sửa đổi làm trong Blender.
2. Không sửa tay `exported/`. Chỉ lệnh xuất mới ghi vào đó.
3. Mỗi tệp `.blend` chỉ một người sửa tại một thời điểm, vì không gộp được như mã.
4. `assets.config.json` là hợp đồng giữa người làm 3D và người viết mã.

## Tệp gốc

| Tệp                    | Chứa                                             | Mở khi cần                          |
| ---------------------- | ------------------------------------------------ | ----------------------------------- |
| `character-base.blend` | Bộ xương `rig`, thân `body`                      | Sửa dáng người, áo, quần, giày, mặt |
| `clips.blend`          | 36 clip chuyển động                              | Sửa hoặc thêm chuyển động           |
| `hair-default.blend`   | Tóc `hair`                                       | Nặn lại tóc                         |
| `accessories.blend`    | `glasses`, `headset`, `backpack`, `cup`, `crate` | Sửa phụ kiện và đồ cầm tay          |
| `props-station.blend`  | Bàn máy `station`                                | Sửa bàn, ghế, màn hình              |

Đối tượng tên `guide_...` là khung dây để canh khoảng cách. Chúng không được xuất ra.

## Chuẩn bị

Cần Git LFS và Blender 5.2 trở lên. `pnpm bootstrap` đã bật Git LFS và tải sẵn các tệp. Blender nằm ở vị trí lạ thì đặt biến `BLENDER_PATH`.

## Sửa một tài sản

```
git lfs lock packages/game-assets/source/hair-default.blend
```

1. Tách nhánh từ `staging` theo issue, rồi khoá tệp như trên. Tệp đang bị người khác khoá thì chờ hoặc trao đổi với họ.
2. Mở tệp, sửa, lưu. Giữ nguyên tên đối tượng và tên xương. Apply mọi modifier trừ Armature, vì lệnh xuất từ chối modifier chưa apply.
3. Chạy `pnpm assets:export`. Lệnh ghép các tệp gốc, xuất `.glb`, tạo bản nhẹ rồi tự kiểm.
4. Chạy `pnpm assets:library` và xem động tác đã sửa để nhìn tận mắt.
5. Commit cả tệp `.blend`, tệp `.glb` và `export-stamp.json` rồi mở PR như mọi việc khác.
6. PR merge xong thì mở khoá: `git lfs unlock <tệp>`.

## Hai người cùng làm

Mỗi người khoá một tệp `.blend` khác nhau, nhưng tệp `.glb` và `export-stamp.json` là kết quả chung nên vẫn xung đột khi PR thứ hai cập nhật từ `staging`. Khi đó không gộp tay. Giữ tệp `.blend` của cả hai bên, lấy tạm phiên bản bất kỳ của `exported/`, rồi chạy lại `pnpm assets:export` và commit.

Vật liệu dùng chung, như `logo_canvas`, có bản sao trong nhiều tệp gốc. Đổi vật liệu thì đổi ở mọi tệp có nó, nếu không lệnh xuất sẽ báo lỗi.

## Việc thường gặp

| Việc           | Cách làm                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| Chỉnh một clip | Mở `clips.blend`, chọn Action trong Action Editor, sửa keyframe                                       |
| Thêm clip      | Tạo Action mới, bật Fake User để không bị mất khi lưu, thêm tên vào `clips` trong cấu hình            |
| Nặn lại tóc    | Sửa đối tượng `hair`, giữ nhóm đỉnh `head` và lớp màu `Col`                                           |
| Thêm đồ vật    | Tạo `props-<tên>.blend` có một đối tượng, khai vào `props` trong cấu hình                             |
| Đổi tên xương  | Không đổi. Mọi clip và mọi món đồ đều bám vào tên xương. Cần đổi thì hỏi người chính về 3D và ghi ADR |

## Ngân sách

Giới hạn tam giác từng món nằm trong `assets.config.json`. Bản nhẹ dùng khi cảnh đông người, tự giảm thân và tóc còn tổng khoảng 10.000 tam giác. Muốn tăng ngân sách thì nêu lý do trong PR, và kiểm lại FPS trên GPU thật.

## Bộ kiểm chặn gì

| Lỗi                                                  | Chặn ở            |
| ---------------------------------------------------- | ----------------- |
| Sửa `.blend` mà quên xuất lại                        | `pnpm verify`, CI |
| Sửa `.glb` ngoài lệnh xuất                           | `pnpm verify`, CI |
| Thêm tệp hoặc khai tệp mà chưa xuất                  | `pnpm verify`, CI |
| Tệp không lưu bằng Git LFS                           | CI                |
| Máy chưa có Git LFS                                  | Hook khi push     |
| Sai xương, thiếu clip, vượt ngân sách                | Lệnh xuất         |
| Mesh chưa gắn xương, thiếu lớp màu bắt buộc          | Lệnh xuất         |
| Modifier chưa apply, vật liệu khác nhau giữa các tệp | Lệnh xuất         |

Lệnh xuất chỉ ghi `export-stamp.json` khi mọi kiểm đều qua. Xuất lỗi thì `pnpm verify` đỏ cho tới khi sửa xong. Workflow `assets` kiểm lại nội dung thật trên PR, hiện chưa phải check bắt buộc.

Bộ kiểm chỉ thấy cấu trúc. Clip sai dáng hay tóc xấu vẫn cần người nhìn.

## Ai làm được gì

| Mức                  | Cần biết              | Làm được                                      |
| -------------------- | --------------------- | --------------------------------------------- |
| Không dùng Blender   | Web, dữ liệu          | Ghép vào game, đổi màu, thêm món vào danh mục |
| Cơ bản, học vài buổi | Di chuyển, chỉnh khớp | Chỉnh clip, làm đồ vật, biến thể đồ mặc       |
| Người chính          | Rig, sculpt           | Giữ bộ xương, nặn tóc, duyệt chất lượng       |

## Hiện trạng

- Áo, quần, giày còn chung mesh `body`. Tách thành ô đồ là việc của M1.
- Dòng bot và con hẻm chưa làm bằng Blender.
- Chưa đo FPS trên GPU thật.
- `apps/web-3d` chưa dùng các tệp này. Khi dùng, bước build cần tải Git LFS.
