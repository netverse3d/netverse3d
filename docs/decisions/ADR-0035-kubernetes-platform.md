# ADR-0035: Chạy hệ thống trên Kubernetes local bằng k3d, Kustomize và operator dữ liệu

- Trạng thái: accepted
- Ngày: 2026-11-15
- Xem thêm: [ADR-0003](./ADR-0003-seven-services.md), [ADR-0022](./ADR-0022-per-component-release-tags.md), [ADR-0023](./ADR-0023-media-service-origin-and-object-storage.md), [ADR-0028](./ADR-0028-service-to-service-communication.md), [ADR-0034](./ADR-0034-api-gateway.md)

## Bối cảnh

ADR-0003 chọn Kubernetes để triển khai, và REQ-026 đặt production trên Kubernetes ở mốc M8. Hiện hệ thống chỉ chạy bằng Compose. Nhóm muốn chạy được trên Kubernetes ngay, để cổng vào, service và dữ liệu được kiểm trên cùng nền tảng sẽ dùng thật, mà chưa cần máy chủ.

## Quyết định

1. Cụm local là k3d một node chạy k3s, tắt Traefik đi kèm để dùng bản Traefik đã ghim.
2. Compose giữ cho dev hằng ngày. Cùng các route chạy trên cụm, và một bộ kiểm cổng chạy cho cả hai môi trường.
3. Dữ liệu chạy trong cụm:
   - PostgreSQL bằng CloudNativePG. Mỗi service có một database và một role riêng làm chủ database đó.
   - Kafka bằng Strimzi, một node KRaft.
   - Object storage là SeaweedFS chạy bằng StatefulSet.
   - Ở cụm local có thêm hộp thư giả lập.
4. Manifest đóng gói bằng Kustomize: `base` cho từng phần, overlay `local` chạy thật, overlay `staging` là khung được kiểm tĩnh. Production để việc triển khai production.
5. Manifest của bên thứ ba (Gateway API, Traefik, CloudNativePG, Strimzi) được tham chiếu bằng URL ghim theo tag phát hành, không chép vào repo.
6. Migration chạy trong initContainer của từng service bằng `prisma migrate deploy`. Prisma giữ khoá trên database nên nhiều bản chạy cùng lúc vẫn an toàn.
7. Topic Kafka do service tạo lúc khởi động như trong Compose; không khai topic bằng tài nguyên của Strimzi.
8. Redis và bộ quan sát chưa lên cụm, vì chưa service nào dùng Redis và yêu cầu quan sát còn ở mốc M8.
9. Namespace tách theo vai trò:
   - `netverse`: ứng dụng, Gateway và route;
   - `netverse-data`: dữ liệu;
   - `netverse-system`: Traefik;
   - `cnpg-system`, `strimzi`: operator.

   Namespace ứng dụng chặn mọi lưu lượng vào, trừ từ cổng và từ chính nó.

10. Manifest phải qua hai bước kiểm tĩnh:
    - kubeconform với schema của mọi kind, không bỏ qua kind nào;
    - một bộ luật của repo về workload: image ghim, giới hạn bộ nhớ, chạy không root, probe, nhãn Pod Security, NetworkPolicy, không đặt giá trị Secret ở overlay staging.
11. Secret của cụm local dùng các giá trị mẫu chỉ dùng ở local như Compose. Ở staging và production, Secret do người vận hành tạo ngoài repo.
12. Phiên bản ghim:

| Thành phần     | Phiên bản             |
| -------------- | --------------------- |
| k3d            | 5.9.0                 |
| k3s            | v1.35.9+k3s1          |
| kubectl        | 1.35.10               |
| Gateway API    | v1.6.3, kênh Standard |
| Traefik        | v3.7.17               |
| CloudNativePG  | 1.30.1                |
| PostgreSQL     | 17.11                 |
| Strimzi        | 1.3.0                 |
| Kafka trên cụm | 4.2.1                 |
| SeaweedFS      | 4.53                  |
| kubeconform    | 0.8.0                 |

## Hệ quả

- Dev muốn chạy cụm cần Docker, k3d và kubectl đúng bản. Cụm local cần khoảng 6 GB RAM cho Docker.
- Kafka trên cụm là 4.2 trong lúc Compose vẫn là 3.9. Kịch bản xuyên service chạy trên cả hai để bắt lệch.
- Ứng dụng web chạy image nginx có tiến trình chính là root, nên được miễn luật chạy không root và chạy ở mức Pod Security baseline.
- CI dựng cụm thật cho mọi thay đổi hạ tầng, nên thời gian chạy của các PR đó dài hơn.
- TLS thật, máy chủ staging và production chưa có trong quyết định này.
