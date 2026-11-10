# ADR-0018: Mô hình bàn máy và phòng có bản gốc là script trong repo

- Trạng thái: accepted
- Ngày: 2026-11-10

## Bối cảnh

[ADR-0015](./ADR-0015-blender-sources-as-master.md) chốt tệp `.blend` là bản gốc của mọi tài sản 3D, script sinh chỉ chạy một lần và không vào repo.

Thực tế sau đó khác đi với nhóm đồ cứng. Bàn máy, ghế, các món trên bàn, bộ module phòng và cảnh giới thiệu được sinh lại nhiều lần bằng script Python chạy trong Blender, mỗi lần sinh ghi đè tệp `.blend`. Các script này nằm ngoài repo, trên một máy, không có lịch sử.

Hệ quả là người clone repo có tệp `.blend` nhưng không có thứ sinh ra nó; ai sửa tay trong Blender sẽ mất phần sửa ở lần sinh kế tiếp mà không được báo; mất máy đó là mất cách dựng lại.

Người dẫn dắt nhóm chọn ngày 2026-11-10: đưa script vào repo và ghi rõ loại bản gốc của từng tệp.

## Quyết định

**Hai loại bản gốc**

- Tài sản dựng trong Blender: bản gốc là tệp `.blend`, đúng như ADR-0015. Gồm thân và xương nhân vật, clip, tóc, phụ kiện.
- Tài sản sinh từ script: bản gốc là script. Tệp `.blend` là kết quả trung gian do script ghi ra. Gồm bộ ô đồ bàn máy `parts-station.blend`, bộ module phòng `environment-kit.blend` và cảnh giới thiệu `showcase-tim-neon.blend`.
- Mỗi tệp trong `source/` thuộc đúng một loại, và loại đó được khai trong `assets.config.json`.

**Script nằm ở đâu**

- Script sinh nằm trong `packages/game-assets`, đi qua PR như mọi mã khác.
- Script không mang đường dẫn tuyệt đối của máy nào. Đường dẫn tính từ vị trí của chính nó hoặc nhận qua tham số.
- Chỉ đưa vào các script còn dùng để sinh tệp đang có trong `source/`. Bản thử cũ và tệp trung gian để ngoài.
- Ảnh và mô hình tham chiếu của bên khác không vào repo, kể cả khi script từng được viết trong lúc nhìn chúng.

**Cách sửa**

- Tài sản sinh từ script: sửa script, chạy lại để sinh `.blend`, xuất `.glb`, commit cả ba. Không sửa tay tệp `.blend` loại này.
- Tài sản dựng trong Blender: giữ quy trình khoá tệp và sửa trong Blender của ADR-0015.
- Muốn chuyển một tệp từ loại sinh sang loại dựng tay thì đổi khai báo trong `assets.config.json` trong cùng PR, và từ đó không chạy script cho tệp ấy nữa.

**Nguồn gốc**

- Mô hình vẫn là `provenance: original`. Script dựng hình khối bằng số đo viết trong mã, không đọc lưới hay texture từ tệp bên ngoài.

## Hệ quả

- Thành viên nào có Blender cũng sinh lại được bàn máy, phòng và cảnh giới thiệu, và đổi kích thước bằng cách sửa số trong script.
- Câu "script sinh không vào repo, mọi sửa đổi làm trong Blender" của ADR-0015 chỉ còn áp cho tài sản dựng trong Blender.
- Chưa có bước kiểm tự động rằng tệp `.blend` đang lưu đúng là kết quả của script hiện tại. Đến khi có, việc này dựa vào quy trình sửa ở trên.
- Sinh lại cần đúng phiên bản Blender mà trang hướng dẫn tài sản ghi, vì kết quả boolean và bake đổi theo phiên bản.
- Trang hướng dẫn tài sản phải có thêm mục cho tài sản sinh từ script khi script vào repo.

Liên quan: REQ-040, [ADR-0015](./ADR-0015-blender-sources-as-master.md), [ADR-0016](./ADR-0016-shop-identity-as-data.md).
