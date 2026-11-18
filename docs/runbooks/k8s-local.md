# Chạy hệ thống trên Kubernetes local

Dựng cụm k3d một node chạy cổng Traefik, PostgreSQL bằng CloudNativePG, Kafka bằng Strimzi, object storage và các service, theo [ADR-0035](../decisions/ADR-0035-kubernetes-platform.md). Dùng khi sửa `infra/k8s`, `infra/gateway`, Dockerfile của service, hoặc muốn thử hệ thống trên cùng nền tảng sẽ triển khai. Dev hằng ngày vẫn dùng [Compose](./stack-smoke.md).

## 1. Cần gì

| Công cụ     | Phiên bản  | Kiểm                                |
| ----------- | ---------- | ----------------------------------- |
| Docker      | RAM ≥ 6 GB | `docker info`, xem mục Total Memory |
| k3d         | 5.9.0      | `k3d version`                       |
| kubectl     | 1.35       | `kubectl version --client`          |
| kubeconform | 0.8.0      | `kubeconform -v`                    |

Ổ chứa dữ liệu Docker cần còn ít nhất 25 GB. `pnpm k8s:up` tự đo và dừng nếu thiếu. Trên Windows với Docker Desktop, tệp đĩa ảo chỉ nở chứ không tự co; xem mục 6.

## 2. Đo trước

| Điều cần đo       | Lệnh                                                                 | Kỳ vọng                               | Lệch thì                           |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------- | ---------------------------------- |
| Cổng host trống   | thử mở `58180`, `58335`, `56443`, `59192`, `59193`, `53203`, `58125` | không cổng nào bị chiếm               | Dừng, tắt tiến trình đang giữ cổng |
| Không có cụm hỏng | `k3d cluster list`                                                   | không có `netverse`, hoặc có và `1/1` | `pnpm k8s:down` rồi đo lại         |

## 3. Dựng cụm

```
pnpm k8s:up
```

Lệnh kiểm phiên bản công cụ và đĩa trống, build sáu image cho các service, web và UI tài liệu, tạo cụm `netverse`, nạp image, cài Gateway API, Traefik, CloudNativePG, Strimzi, rồi áp overlay `local` và chờ mọi thứ sẵn sàng. Lần đầu mất khoảng 10–20 phút.

Kết quả mong đợi: dòng cuối `Cluster netverse is ready at http://127.0.0.1:58180/`.

Mọi lệnh dùng context `k3d-netverse`; tạo cụm không đổi context hiện tại của máy.

## 4. Kiểm sau

| Kiểm                                                                                         | Đạt khi                                        |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `kubectl --context k3d-netverse get gatewayclass traefik`                                    | `ACCEPTED` là `True`                           |
| `kubectl --context k3d-netverse -n netverse-data get cluster.postgresql.cnpg.io netverse-pg` | `Cluster in healthy state`                     |
| `kubectl --context k3d-netverse -n netverse-data get kafka netverse-kafka`                   | `READY` là `True`                              |
| `kubectl --context k3d-netverse -n netverse get deploy`                                      | mọi deploy `1/1`                               |
| `kubectl --context k3d-netverse -n netverse get httproute`                                   | mọi route có trong `infra/gateway/routes.yaml` |
| `curl http://127.0.0.1:58180/api/identity/v1/auth/providers`                                 | 200                                            |
| `curl http://127.0.0.1:58180/docs/config.json`                                               | 200, có ba service trong menu                  |

Rồi chạy ba bộ kiểm:

```
GATEWAY_URL=http://127.0.0.1:58180 GATEWAY_STORAGE_URL=http://127.0.0.1:58335 GATEWAY_WS_PROBE=1 pnpm test:gateway
pnpm smoke:k8s
K8S_CONTEXT=k3d-netverse pnpm test:k8s
```

Kết quả mong đợi: `# fail 0` ở cả hai bộ test và dòng cuối `STACK SMOKE PASSED` ở smoke.

## 5. Kiểm manifest

```
pnpm k8s:check
```

Lệnh render `platform` và mọi overlay, kiểm bằng kubeconform với schema của mọi kind (không bỏ qua kind nào), rồi kiểm bộ luật của repo:

| Luật | Đòi hỏi                                                                                               | Sửa                                            |
| ---- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| P1   | Image có tag, không phải `latest`; staging dùng `ghcr.io/netverse3d/`                                 | Ghim tag                                       |
| P2   | Container có `requests.memory` và `limits.memory`                                                     | Thêm `resources`                               |
| P3   | App chạy không root, không leo quyền, bỏ mọi capability, hệ tệp gốc chỉ đọc, seccomp `RuntimeDefault` | Thêm `securityContext`; ghi tạm vào `emptyDir` |
| P4   | Deployment trong `netverse` có readiness và liveness                                                  | Thêm probe                                     |
| P5   | Namespace có nhãn Pod Security                                                                        | Thêm nhãn `pod-security.kubernetes.io/enforce` |
| P6   | Không `hostNetwork`, `hostPath`, `privileged`                                                         | Bỏ                                             |
| P7   | `NodePort` chỉ ở overlay `local`                                                                      | Dùng `ClusterIP` và cổng vào                   |
| P8   | Namespace `netverse` có `default-deny-ingress` khi có workload                                        | Giữ `network-policy.yaml`                      |
| P9   | Overlay `staging` không chứa giá trị Secret                                                           | Người vận hành tạo Secret ngoài repo           |
| P10  | Secret basic-auth có `username` và `password`                                                         | Bổ sung khoá                                   |
| P11  | Biến môi trường `$(X)` chỉ dùng `X` đã khai trước nó                                                  | Đổi thứ tự `env`                               |

## 6. Lỗi hay gặp

| Thấy                                          | Nguyên nhân                                      | Làm gì                                                                                           |
| --------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `only … GB free where Docker stores data`     | Ổ chứa Docker gần đầy                            | Xoá image thử và build cache (`docker builder prune -af`), rồi nén tệp đĩa ảo của Docker Desktop |
| `k3d … found, … required`                     | Sai bản công cụ                                  | Cài đúng bản ở mục 1                                                                             |
| Pod `ImagePullBackOff` với `netverse/*:local` | Image chưa được nạp vào cụm                      | `pnpm k8s:images`                                                                                |
| HTTPRoute `ResolvedRefs=False`                | Service đích chưa có hoặc thiếu `ReferenceGrant` | Kiểm tên service và `infra/gateway/routes.yaml`                                                  |
| Kafka mãi chưa `Ready`                        | Thiếu RAM cho node Kafka                         | Tăng RAM cho Docker, xem `kubectl -n netverse-data describe pod`                                 |
| Pod app `CrashLoopBackOff` ngay sau migrate   | Database chưa sẵn sàng hoặc sai mật khẩu role    | Xem log `-c migrate`, kiểm `cluster.postgresql.cnpg.io`                                          |

## 7. CI

Workflow `k8s` chạy trên mọi PR chạm `infra/k8s`, `infra/gateway`, script cụm hoặc Dockerfile: job `render` chạy `pnpm k8s:check`, job `cluster` dựng cụm và chạy ba bộ kiểm ở mục 4. Job đỏ thì đọc phần log sự kiện, log từng pod và log Traefik ở cuối job.

## 8. Gỡ

```
pnpm k8s:down
```

Kết quả mong đợi: `k3d cluster list` không còn `netverse`. Image `netverse/*:local` vẫn ở lại vì Compose dùng chung; xoá bằng `docker rmi` khi không cần.
