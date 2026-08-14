# Runbook: triển khai bản vá bảo mật lên production

Các bản vá code đã nằm trên nhánh `security/remediation-2026-08`. Tài liệu này là
phần **phải làm thủ công trên server**, vì nó đụng vào dữ liệu đang chạy.

Đọc hết một lượt trước khi gõ lệnh đầu tiên. Chấp nhận downtime — toàn bộ người
dùng sẽ bị đăng xuất.

---

## Bước 0 — Sao lưu (bắt buộc, không được bỏ)

Đây là đường lùi duy nhất nếu có sự cố ở bước 3.

```bash
cd /đường/dẫn/OmniRAG

# Postgres — bản lùi duy nhất cho token kênh nếu bước 3 sai
docker compose exec -T db pg_dump -U postgres -Fc omnirag > ~/omnirag_pre.dump
docker compose exec -T db psql -U postgres -d omnirag -At \
  -c "SELECT id, config FROM bots" > ~/bots_config_pre.tsv
wc -l ~/bots_config_pre.tsv          # phải > 0

# MongoDB
docker compose exec -T mongodb mongodump -u admin -p password \
  --authenticationDatabase admin --archive > ~/omnirag_mongo_pre.archive

# Qdrant — snapshot NẰM NGOÀI volume, bắt buộc copy ra host
docker compose exec -T qdrant sh -c \
  'curl -sX POST http://localhost:6333/collections/omnirag_openrouter_collection_v3/snapshots'
# lấy tên "name" từ output rồi:
docker compose cp qdrant:/qdrant/snapshots/omnirag_openrouter_collection_v3/<TÊN> ~/
ls -lh ~/<TÊN>                       # phải khác 0
```

> `/qdrant/snapshots` không nằm trong volume `qdrant_data`. Snapshot tạo ra sống
> trong lớp ghi của container và **biến mất khi `--force-recreate`**. Không copy
> ra host thì coi như không có backup.

**Ghi lại toàn bộ credential hiện tại** vào nơi an toàn ngoài repo trước khi đổi.

---

## Bước 1 — Rút cạn hàng đợi Celery

Đổi chữ ký task hoặc restart khi hàng đợi còn việc sẽ làm tài liệu kẹt
"processing" vĩnh viễn.

```bash
docker compose exec -T redis redis-cli LLEN celery    # chờ về 0
```

---

## Bước 2 — Sinh secret mới

**Chỉ dùng hex.** Chuỗi kết nối Postgres/Mongo/Redis được ghép bằng nội suy thô,
không percent-encode — mật khẩu chứa `@ : / ? # %` sẽ tạo ra chuỗi kết nối *sai*
chứ không báo lỗi.

```bash
for k in SECRET_KEY JWT_SECRET POSTGRES_PASSWORD MONGO_PASSWORD MINIO_ROOT_PASSWORD; do
  echo "$k=$(openssl rand -hex 32)"
done
```

Chép kết quả vào `.env` ở thư mục gốc (compose chỉ tự nạp file này — `.env.prod`
không được file nào đọc). Dùng `.env.example` làm khung.

Kiểm tra trước khi deploy:

```bash
python3 scripts/validate_env.py
```

---

## Bước 3 — Đổi mật khẩu trong chính database

Biến `POSTGRES_PASSWORD` / `MONGO_INITDB_ROOT_PASSWORD` **chỉ có tác dụng lúc
initdb**. Volume đã tồn tại, nên sửa compose thôi là chưa đổi gì cả — container
vẫn chạy với mật khẩu cũ, không cảnh báo, không lỗi.

```bash
# Dừng consumer TRƯỚC: pool của SQLAlchemy giữ kết nối đã xác thực, nên
# nếu đổi khi đang chạy thì mọi thứ có vẻ vẫn ổn cho tới lúc pool tái tạo.
docker compose stop backend celery_worker fb-channel-worker zalo-personal-worker gateway

docker compose exec -T db psql -U postgres -d omnirag \
  -c "ALTER ROLE postgres WITH PASSWORD '<POSTGRES_PASSWORD mới>';"

docker compose exec -T mongodb mongosh -u admin -p password --authenticationDatabase admin \
  --eval "db.getSiblingDB('admin').changeUserPassword('admin','<MONGO_PASSWORD mới>')"
```

MinIO đọc credential từ env mỗi lần khởi động nên chỉ cần đổi biến rồi restart;
dữ liệu giữ nguyên. Lưu ý mọi presigned URL đang phát hành sẽ hỏng ngay.

**Kiểm tra mật khẩu cũ đã chết:**

```bash
docker compose exec -T db psql "postgresql://postgres:password@127.0.0.1:5432/omnirag" -c "SELECT 1"
# PHẢI lỗi: password authentication failed

docker compose exec -T mongodb mongosh -u admin -p password --authenticationDatabase admin \
  --eval "db.adminCommand('ping')"
# PHẢI lỗi: Authentication failed
```

---

## Bước 4 — Deploy

```bash
git checkout security/remediation-2026-08
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Nếu thiếu biến, compose sẽ **dừng và báo tên biến** thay vì chạy với giá trị yếu.
Đó là hành vi đúng.

---

## Bước 5 — Xoá cache gateway

Config bot chưa che đang nằm trong Redis dạng plaintext.

```bash
# TUYỆT ĐỐI KHÔNG dùng FLUSHDB — cache gateway và broker Celery dùng chung db 0,
# xoá sạch là mất luôn hàng đợi tài liệu đang xử lý.
docker compose exec -T redis sh -c \
  'redis-cli --scan --pattern "gateway:cache:*" | xargs -r redis-cli DEL'
```

---

## Bước 6 — Xác minh

```bash
# Từ MÁY NGOÀI — tất cả phải đóng
nmap -Pn -p 5433,27017,6380,9000,9001,6333,8001,5002 <host>

# Docs phải 404
curl -o /dev/null -w '%{http_code}\n' https://<host>/docs

# Router IDOR đã gỡ — phải 404
curl -o /dev/null -w '%{http_code}\n' -X POST https://<host>/api/v1/openrouter/rag/chat \
  -H "Authorization: Bearer $TOKEN" -d '{"bot_id":"x","query":"y"}'

# Webhook không kèm secret — phải 403
curl -o /dev/null -w '%{http_code}\n' -X POST \
  https://<host>/api/v1/channels/zalo/hub-webhook -H 'Content-Type: application/json' -d '{}'

# GET /bots không được chứa token thật
curl -s https://<host>/api/v1/bots/ -H "Authorization: Bearer $TOKEN" \
  | grep -c '"bot_token": *"[^_]'      # phải là 0
```

**Kiểm tra chức năng:** đăng nhập lại, mở tab Channels của một bot đang kết nối
Telegram và xác nhận vẫn hiện "đã kết nối", bấm Save Settings, rồi gửi thử một
tin nhắn tới bot đó. Bước này xác nhận việc che secret không làm mất token.

---

## Bước 7 — Soát dấu hiệu đã bị truy cập

Hệ thống từng phơi ra Internet với mật khẩu mặc định, nên phải kiểm tra:

```bash
# Tài khoản lạ
docker compose exec -T db psql -U postgres -d omnirag \
  -c "SELECT email, role, created_at FROM users ORDER BY created_at DESC LIMIT 30;"

# Bot lạ
docker compose exec -T db psql -U postgres -d omnirag \
  -c "SELECT name, tenant_id, created_at FROM bots ORDER BY created_at DESC LIMIT 30;"

# Object lạ trong MinIO
docker compose exec -T minio mc ls --recursive local/omnirag | tail -50
```

Kiểm tra thêm lịch sử dùng credit trên bảng điều khiển OpenRouter, vì khoá cũ
từng nằm công khai trên GitHub.

---

## Còn tồn đọng (chưa làm trong đợt này)

| Việc | Vì sao hoãn |
|---|---|
| Thêm `tenant_id` vào payload Qdrant | Cần migration 3 bước có backfill; đảo thứ tự sẽ làm mọi bot trả lời rỗng. Hiện việc tách tenant dựa hoàn toàn vào tầng endpoint |
| Bật `requirepass` cho Redis | Cần sửa đồng bộ 5 chỗ, gồm `CELERY_BROKER_URL` và `CELERY_RESULT_BACKEND` mà compose không truyền; thiếu một chỗ là Celery chết |
| Bật API key cho Qdrant | Cần sửa code ở 4 chỗ khởi tạo client + biến môi trường cho LightRAG trước |
| Chuyển frontend sang nginx `Dockerfile.prod` | Đổi đường đi của request lần đầu; kèm 5 rủi ro cùng lúc, cần một cửa sổ riêng. Nhớ gỡ hoặc thêm xác thực cho `location /minio` trong `nginx.conf` |
| Chặn upload theo `Content-Length` + kiểm magic byte | Cần middleware ASGI mới |
| Chống replay webhook (timestamp + nonce) | Cần đổi cả phía worker |

Cả sáu đều là phòng thủ lớp hai. Sau bước 6, không còn datastore nào ra Internet
nên bề mặt tấn công đã thu hẹp đáng kể.
