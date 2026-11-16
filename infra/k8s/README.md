# Kubernetes

Manifest để chạy toàn hệ thống trên Kubernetes, theo [ADR-0035](../../docs/decisions/ADR-0035-kubernetes-platform.md). Cụm local là k3d một node.

| Thư mục            | Chứa gì                                               |
| ------------------ | ----------------------------------------------------- |
| `k3d/`             | Cấu hình cụm local                                    |
| `platform/`        | Gateway API, Traefik, CloudNativePG, Strimzi          |
| `base/`            | Dữ liệu, service, cổng vào                            |
| `components/`      | Phần ghép thêm cho cụm local, như route thử WebSocket |
| `overlays/local`   | Cụm local, chạy thật                                  |
| `overlays/staging` | Khung cho staging, chỉ kiểm tĩnh                      |
| `versions.json`    | Phiên bản đã ghim của công cụ và thành phần           |

## Cần cài

| Công cụ     | Phiên bản     | Kiểm                                   |
| ----------- | ------------- | -------------------------------------- |
| Docker      | có RAM ≥ 6 GB | `docker info --format '{{.MemTotal}}'` |
| k3d         | 5.9.0         | `k3d version`                          |
| kubectl     | 1.35          | `kubectl version --client`             |
| kubeconform | 0.8.0         | `kubeconform -v`                       |

`pnpm k8s:up` dừng ngay nếu k3d hoặc kubectl khác bản ghim.

## Lệnh

| Lệnh              | Làm gì                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm k8s:up`     | Tạo cụm `netverse` nếu chưa có, dựng và nạp image, cài nền tảng, áp overlay local, chờ mọi thứ sẵn sàng |
| `pnpm k8s:images` | Dựng lại và nạp image của các service vào cụm                                                           |
| `pnpm k8s:status` | Liệt kê pod                                                                                             |
| `pnpm k8s:check`  | Kiểm tĩnh manifest bằng kubeconform và bộ luật của repo                                                 |
| `pnpm k8s:down`   | Xoá cụm                                                                                                 |

Mọi lệnh `kubectl` dùng context `k3d-netverse`; tạo cụm không đổi context hiện tại của máy.

## Cổng trên máy

| Cổng    | Dùng cho                         |
| ------- | -------------------------------- |
| `56443` | API server của cụm (kubectl)     |
| `58180` | Cổng web của gateway             |
| `58335` | Cổng storage của gateway         |
| `59192` | Kafka bootstrap, cho smoke       |
| `59193` | Kafka broker, cho smoke          |
| `53203` | gRPC của notification, cho smoke |
| `58125` | Hộp thư giả lập                  |

Cách dựng, kiểm và gỡ cụm từng bước ở [runbook cụm local](../../docs/runbooks/k8s-local.md).
