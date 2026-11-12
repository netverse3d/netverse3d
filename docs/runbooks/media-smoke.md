# Chạy thử media service trên hạ tầng dev

Dùng lúc cần biết media service chạy thật được với PostgreSQL và object storage: sau khi sửa service, sửa `Dockerfile` hoặc sửa `infra/compose`. Chạy lần lượt, bước nào sai kết quả mong đợi thì dừng ở đó.

Cần Docker đang chạy và đã `pnpm install`. Các lệnh chạy từ gốc repo.

## 1. Bật hạ tầng

```
pnpm infra:up
```

Kết quả mong đợi: lệnh kết thúc với mã 0. `curl http://127.0.0.1:58333/healthz` trả 200.

## 2. Bật bộ phát token mẫu

`identity` chưa có trong repo, nên media kiểm token bằng một bộ phát mẫu chạy trên máy. Mở một cửa sổ riêng và để nó chạy:

```
pnpm --filter @netverse/media dev:issuer
```

Kết quả mong đợi: `curl http://127.0.0.1:4000/.well-known/jwks.json` trả 200.

Trên Linux không dùng Docker Desktop, container không tới được cổng chỉ mở ở `127.0.0.1` của máy. Lúc đó chạy bộ phát với `DEV_ISSUER_HOST=0.0.0.0` và chỉ làm vậy trên máy dev, vì bộ phát này cấp token cho bất kỳ ai gọi tới.

## 3. Dựng và chạy media

```
docker compose --env-file .env.example -f infra/compose/compose.yaml --profile apps up -d --build media
```

Lệnh dựng image từ gốc repo, chạy migration vào database `media`, rồi chạy service.

Kết quả mong đợi:

| Kiểm                                     | Kết quả                              |
| ---------------------------------------- | ------------------------------------ |
| `curl http://127.0.0.1:53001/livez`      | 200                                  |
| `curl http://127.0.0.1:53001/healthz`    | 200, tức đã nối được database và kho |
| `docker compose ... ps media-migrate -a` | trạng thái `Exited (0)`              |

`/healthz` trả 503 thì xem `docker compose ... logs media`: thường là sai khoá của kho hoặc database chưa có.

## 4. Chạy kịch bản tải lên, hoàn tất, tải về

```
docker compose --env-file .env.example -f infra/compose/compose.yaml --profile apps --profile smoke run --rm media-smoke
```

Kịch bản chạy bên trong mạng Docker. Nó xin token, xin URL tải lên, đẩy tệp thẳng lên kho, báo hoàn tất, xin URL tải về và so nội dung, rồi thử giữ lâu dài, liệt kê, xoá và đọc audit.

Kết quả mong đợi: dòng cuối là `SMOKE PASSED`, mã thoát 0.

## 5. Dọn

```
docker compose --env-file .env.example -f infra/compose/compose.yaml --profile apps --profile smoke down
pnpm infra:down
```

Hai lệnh này dừng và xoá container, giữ lại dữ liệu trong volume. Chỉ xoá volume lúc chắc không cần dữ liệu thử nữa.

## Giới hạn đã biết

Service chỉ có một địa chỉ kho, dùng cho cả việc của chính nó lẫn URL ký sẵn trả cho client. Trong Compose địa chỉ đó là `object-store:8333`, chỉ đúng bên trong mạng Docker. Trình duyệt hoặc lệnh chạy trên máy thật không dùng được URL ký sẵn do bản chạy trong Compose cấp. Vì vậy kịch bản ở bước 4 phải chạy trong mạng Docker. Muốn client ngoài mạng dùng được thì service cần thêm một địa chỉ kho công khai riêng cho việc ký URL.
