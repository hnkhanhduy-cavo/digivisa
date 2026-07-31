# Tích hợp cổng thanh toán 9Pay — DigiVisa

> Tài liệu bàn giao. Ghi lại spec 9Pay đã kiểm chứng thực nghiệm, các quyết định kiến trúc,
> và những gì còn dang dở. Cập nhật: 2026-08-01.

## 1. Bối cảnh

Bản tích hợp 9Pay ban đầu không hoạt động. Nguyên nhân gốc: **dùng sai mô hình tích hợp**.

Code cũ gọi `POST` server-to-server tới `/payments/create` rồi chờ JSON trả về `payment_url`.
9Pay không hoạt động như vậy. Luồng đúng là **tự ký một URL rồi redirect trình duyệt** tới
`{ENDPOINT}/portal?baseEncode=...&signature=...`. Server không gọi HTTP ra ngoài.

Vì POST đó luôn thất bại, code rơi vào fallback `checkoutUrl = returnUrl` → redirect về
`/?payment=success` → `App.tsx` đánh dấu đơn `Paid (9Pay)`. Hệ quả: **mọi đơn đều thành
đã-thanh-toán mà không ai trả tiền**, trong khi bề ngoài trông như hệ thống đang chạy.

Tài liệu `docs/Hướng dẫn sử dụng MCV v2.docx` là hướng dẫn dùng trang quản trị Merchant View,
**không chứa spec API**. Spec thật lấy từ https://developers.9pay.vn/danh-sach-api và code mẫu
chính thức https://gitlab.com/9pay-sample/sample-javascript.

## 2. Spec 9Pay đã kiểm chứng

### 2.1 Endpoint

| Môi trường | URL |
|---|---|
| Sandbox | `https://sand-payment.9pay.vn` |
| Production | `https://payment.9pay.vn` |
| Merchant View sandbox | `https://sand-mcv2.9pay.vn` |

### 2.2 Tạo thanh toán — build URL rồi redirect (KHÔNG gọi API)

```js
const time = Math.round(Date.now() / 1000);
const parameters = {
  merchantKey, time, invoice_no, amount, description, return_url, back_url
};

// Sort key TĂNG DẦN theo alphabet, encode bằng URLSearchParams
function buildHttpQuery(data) {
  const q = new URLSearchParams();
  const ordered = Object.keys(data).sort().reduce((o, k) => (o[k] = data[k], o), {});
  Object.keys(ordered).forEach(k => q.append(k, ordered[k]));
  return q.toString();
}

// Chữ ký 4 phần
const message   = "POST" + "\n" + END_POINT + "/payments/create" + "\n" + time + "\n" + buildHttpQuery(parameters);
const signature = base64(HMAC_SHA256(message, SECRET_KEY));
const baseEncode = base64(JSON.stringify(parameters));   // dùng TextEncoder, KHÔNG btoa trực tiếp
const directUrl  = END_POINT + "/portal?" + buildHttpQuery({ baseEncode, signature });
```

Chuỗi `POST\n{endpoint}/payments/create\n...` chỉ là **nội dung để ký**, không phải request gửi đi.

**Ràng buộc:** `amount` 10.000 – 200.000.000 VND. `invoice_no` ≤ 30 ký tự.
`time` unix 10 chữ số UTC+0, **bắt buộc** (code cũ thiếu → chữ ký sai).
`back_url` phải có mặt trong **cả** `parameters` lẫn canonical query (code cũ chỉ có trong body).

### 2.3 Truy vấn giao dịch — chữ ký chỉ 3 phần

```js
const url     = END_POINT + "/v2/payments/" + invoiceNo + "/inquire";
const message = "GET" + "\n" + url + "\n" + time;        // KHÔNG có canonical query
const signature = base64(HMAC_SHA256(message, SECRET_KEY));

// GET url với headers:
//   Date: <time>
//   Authorization: Signature Algorithm=HS256,Credential=<merchantKey>,SignedHeaders=,Signature=<sig>
```

Trả về payload **phẳng** (không bọc trong `result`/`data`).

### 2.4 IPN — giải mã đúng thứ tự

9Pay POST tới `ipn_url` dạng `x-www-form-urlencoded` với 2 field: `result`, `checksum`.

```js
const std  = result.replace(/-/g, '+').replace(/_/g, '/');
const pad  = std + '='.repeat((4 - std.length % 4) % 4);
const json = new TextDecoder('utf-8').decode(Uint8Array.from(atob(pad), c => c.charCodeAt(0)));
```

**Hai cạm bẫy đã xác minh thực nghiệm:**
1. `result` là base64url (chứa `_`, không padding). `atob(result)` thẳng sẽ **throw**.
   Nhưng checksum phải tính trên chuỗi **thô** — đảo thứ tự là checksum luôn sai.
2. Sample `result.js` của chính 9Pay dùng `buff.toString('ascii')` — **đó là bug**,
   làm hỏng tiếng Việt trong `description`. Phải decode UTF-8.

### 2.5 Mã trạng thái (quan sát thực tế trên sandbox)

| status | Ý nghĩa | HTTP | error_code |
|---|---|---|---|
| `2` | Processing — đã tạo, chưa thanh toán | 200 | `999` |
| `5` | **Thành công** — chỉ mã này mới được set Paid | 200 | — |
| `6` | Không tồn tại / thất bại | **503** | `221` |

⚠️ `/api/9pay-create-payment` **không gọi 9Pay**. Giao dịch chỉ tồn tại bên 9Pay **sau khi
trình duyệt mở URL `/portal`**. Inquire trước thời điểm đó trả `status 6` / HTTP 503.
Đây là câu trả lời nghiệp vụ hợp lệ, không phải lỗi hạ tầng — xem `hasPayload` trong code.

## 3. Quyết định kiến trúc

### 3.1 Dùng Inquire API, không dùng IPN

Không truy cập được Merchant View để đăng ký `ipn_url`. Tài liệu 9Pay chỉ định sẵn cơ chế thay thế:
*"Sau khoảng 20 phút từ khi tạo giao dịch, nếu chưa nhận được IPN thì merchant nên chủ động gọi Inquire."*

Vì vậy **source of truth = Inquire** qua `/api/9pay-verify`. Handler `9pay-webhook` vẫn giữ đúng
logic `verifyAndDecode` + set Paid để sẵn sàng khi đăng ký được `ipn_url`, nhưng hiện **không
được gọi** trong production.

### 3.2 `return_url` KHÔNG đáng tin

Tài liệu 9Pay **không mô tả** `return_url` nhận tham số gì (chỉ IPN mới ghi rõ có `result`+`checksum`).
Vì vậy `?payment=success` chỉ được coi là **tín hiệu UX** để đi hỏi 9Pay, không bao giờ dùng để set Paid.

> **Còn bỏ ngỏ:** cần hỏi 9Pay `return_url` thực tế trả về tham số gì. Khi test sandbox nên
> log toàn bộ `window.location.search` để xác định.

### 3.3 Backstop khi khách không quay lại

Điểm yếu của mô hình redirect-only: khách trả tiền xong đóng trình duyệt → không ai gọi verify.
Xử lý bằng `src/utils/paymentSync.ts`: khi mở tab Tracker/OMS, tự inquire lại các đơn còn Unpaid
tạo trong 24h (debounce 60s/đơn, cooldown 30s/lượt). Ngoài ra có `/api/9pay-sync-unpaid` cho cron ngoài.

### 3.4 Firestore ghi bằng Service Account

Trước đây Function ghi Firestore bằng REST **không auth**, buộc rules phải mở cho mọi caller
→ client tự PATCH `paymentStatus` thành `Paid (9Pay)` được. Nay Function dùng service account
(token SA **bỏ qua** security rules), rules siết chặt hoàn toàn với client.

## 4. Cấu trúc file

### Backend — `functions/`

| File | Vai trò |
|---|---|
| `api/_ninepay.ts` | Helper dùng chung: `buildHttpQuery`, `buildSignature`, `verifyAndDecode`, `inquirePayment`, `buildPaymentPortalUrl` |
| `api/9pay-create-payment.ts` | Build URL portal đã ký. Validate amount/invoice_no. **Không gọi 9Pay** |
| `api/9pay-verify.ts` | Đường **duy nhất** set Paid (khi không có IPN). Gọi Inquire → đối chiếu amount → ghi Firestore |
| `api/9pay-inquire.ts` | Read-only, không đụng Firestore. Dùng để debug |
| `api/9pay-sync-unpaid.ts` | Batch verify cho cron. Bảo vệ bằng `X-Sync-Secret` |
| `api/9pay-webhook.ts` | IPN receiver (POST) + poll trạng thái đơn (GET). **Dormant** đến khi đăng ký `ipn_url` |
| `api/order-claim.ts` | Gắn đơn guest (`trackingToken`) vào Firebase user sau khi đăng nhập. Verify ID token server-side |
| `api/order-lookup.ts` | Tra cứu trạng thái đơn guest theo `trackingToken` (không lộ PII) |
| `api/staff-set-claim.ts` | Ops: gắn custom claim `staff:true`. Bảo vệ bằng `X-Sync-Secret` |
| `_lib/googleAuth.ts` | JWT RS256 → OAuth token cho service account (Web Crypto) |
| `_lib/firestore.ts` | Firestore REST có Bearer token |
| `_lib/firebaseIdToken.ts` | Verify Firebase ID token (RS256, `aud`/`iss`/`exp`) cho claim/lookup |
| `_lib/processInquirePayment.ts` | Logic set Paid: `status === 5` **và** amount khớp |
| `_lib/processPaymentResult.ts` | Logic set Paid từ IPN đã verify checksum |
| `_lib/env.ts` | Kiểu `Env` + `requireNinePayEnv` |

### Frontend — `src/`

| File | Thay đổi |
|---|---|
| `utils/ninepay.ts` | **Xóa sạch secrets**. Chỉ còn hằng số vô hại |
| `utils/paymentSync.ts` | Gọi `/api/9pay-verify`, có debounce |
| `utils/paymentPolling.ts` | Poll sau redirect return |
| `utils/orderIds.ts` | Sinh order ID và `trackingToken` bằng `crypto.getRandomValues` |
| `utils/orderClaim.ts` | Client gọi `/api/order-claim` với các token trong `localStorage` |
| `App.tsx` | `?payment=success` chỉ kích hoạt verify, không set Paid. Validate amount ≥ 10.000 |
| `components/AdminLoginModal.tsx` | Bỏ mật khẩu cứng, dùng Firebase auth + claim `staff` |
| `components/PostBookingAuthModal.tsx` | Sau đặt hàng guest → khuyến khích đăng ký/đăng nhập rồi claim |
| `firestore.rules` | Đọc/ghi đều đòi auth + đúng chủ sở hữu hoặc staff |

### Đã gỡ bỏ

- `build9PayCheckoutUrl()` + `sha256Sync()` — sai thuật toán, sai key, sai HTTP method
- Fallback `checkoutUrl = returnUrl` — nguồn gốc lỗi "mọi đơn đều Paid"
- Nút "I Have Transferred" ghi Paid thẳng vào Firestore
- `simulateIncoming9PayBalanceFluctuation()` và luồng VietQR số tài khoản giả
- Mật khẩu admin cứng `admin123` / `verynoice123`

## 5. Mô hình bảo mật

```
Client ──create order──► Firestore (rules: auth owner / staff; không tự set Paid)
Client ──POST create-payment──► Pages Function ──build signed URL──► redirect browser → 9Pay
Client ──return ?payment=success──► App (UX only) ──verify──► Inquire ──SA write Paid──► Firestore
Cron/Tracker ──sync unpaid──► /api/9pay-verify (cùng path Inquire)
9Pay IPN ──(chưa đăng ký)──► /api/9pay-webhook (sẵn sàng, chưa live)
```

Service account bypass rules nên Function vẫn ghi được.

⚠️ **`firestore.rules` trong repo chỉ là text.** Phải chạy `firebase deploy --only firestore:rules`
thì mới có hiệu lực. Chưa deploy = dữ liệu vẫn phơi ra ngoài.

## 6. Biến môi trường

Local: `.dev.vars` (đã gitignore). Production: `wrangler pages secret put <NAME>`.

| Biến | Nguồn |
|---|---|
| `NINEPAY_MERCHANT_KEY` | 9Pay cấp |
| `NINEPAY_SECRET_KEY` | 9Pay cấp — ký request |
| `NINEPAY_CHECKSUM_KEY` | 9Pay cấp — **chỉ** để verify checksum IPN, không dùng ký |
| `NINEPAY_ENDPOINT` | `https://sand-payment.9pay.vn` (prod: `https://payment.9pay.vn`) |
| `FIREBASE_PROJECT_ID` | `digivisa` |
| `FIREBASE_CLIENT_EMAIL` | Service account JSON |
| `FIREBASE_PRIVATE_KEY` | Service account JSON (giữ nguyên `\n`) |
| `SYNC_SECRET` | Tự sinh: `openssl rand -hex 32` |

> File service account JSON **không được** để trong repo — `.gitignore` hiện chưa chặn nó.
> Tham khảo mẫu biến local: `.dev.vars.example`.

### Dev local

- `npm run dev` — Vite/Express trên port 3000, **không** serve `functions/`.
- `npm run dev:pages` — Wrangler Pages, dùng để test toàn bộ `/api/*` + `.dev.vars`.

## 7. Checklist kiểm chứng

| Hạng mục | Trạng thái |
|---|---|
| Tạo URL + chữ ký 4 phần | ✅ 9Pay chấp nhận (đã verify độc lập bằng HMAC Python) |
| Inquire + chữ ký 3 phần | ✅ Trả dữ liệu thật |
| Chặn `amount < 10.000` | ✅ |
| Cổng chặn `status ≠ 5` | ✅ |
| Secrets khỏi client bundle | ✅ |
| Service account + siết rules | ✅ code xong |
| `order-claim` / `order-lookup` | ✅ code xong |
| Thanh toán thật → `status: 5` | ⏳ chờ thẻ test sandbox từ 9Pay |
| Deploy `firestore.rules` | ⏳ **chưa deploy** |
| Đăng ký `ipn_url` trên Merchant View | ⏳ chưa có quyền truy cập |

## 8. Luồng thanh toán (tóm tắt)

1. Form submit → lưu order Firestore (`amountVnd`, `Pending`, `trackingToken`).
2. `POST /api/9pay-create-payment` → trả `{ paymentUrl, orderId }` (URL đã ký, không gọi 9Pay).
3. Browser redirect tới `/portal?...`.
4. Khách thanh toán trên 9Pay → quay về `return_url` (UX: `?payment=success`).
5. `App.tsx` hiện “Đang xác nhận…” → gọi `/api/9pay-verify`.
6. Verify: Inquire → chỉ set `Paid (9Pay)` khi `status === 5` **và** amount khớp Firestore.
7. Nếu khách không quay lại: Tracker/OMS / cron gọi lại verify cho đơn Unpaid 24h.

## 9. Việc còn lại

### 9.1 Guest order → tài khoản (đã có code — cần verify E2E)

Đơn đặt khi chưa đăng nhập không có `userId`. Rules (đúng) chặn client tự gắn.

Đã có:
- `functions/api/order-claim.ts` — `{ trackingToken, idToken }` → verify Firebase ID token → SA gắn `userId` (409 nếu đã thuộc user khác).
- `functions/api/order-lookup.ts` — tra cứu guest theo token.
- `src/utils/orderClaim.ts` + `PostBookingAuthModal` — claim sau đăng ký/đăng nhập.

Còn cần:
- Kiểm thử E2E: guest đặt → đăng ký/đăng nhập → đơn hiện trong tài khoản.
- Trường hợp user xóa `localStorage` / đổi máy: chỉ còn cách nhập/lưu `trackingToken` thủ công (UX còn mỏng).

### 9.2 Cần hỏi 9Pay

- Thông tin thẻ test sandbox (số thẻ, tên chủ thẻ, ngày hết hạn, OTP)
- `return_url` thực tế trả về những tham số gì
- Quyền truy cập Merchant View để đăng ký `ipn_url`

### 9.3 Ops / deploy

- `firebase deploy --only firestore:rules`
- Set secrets production qua `wrangler pages secret put …`
- (Tuỳ chọn) cron gọi `POST /api/9pay-sync-unpaid` với header `X-Sync-Secret`
- Khi có Merchant View: đăng ký `ipn_url` → `/api/9pay-webhook` và cân nhắc giảm phụ thuộc Inquire-only

### 9.4 Lỗi TypeScript có sẵn (không do session 9Pay)

`npm run lint` còn báo, đều tồn tại từ trước và không liên quan 9Pay:
- `SafeServiceBoundary` thiếu kiểu `React.Component` (`src/App.tsx`)
- Key `'Test Sandbox'` chưa khai báo trong type (`AirportPickupForm.tsx`, `FastTrackForm.tsx`)

## 10. Tham chiếu ngoài

- Spec API: https://developers.9pay.vn/danh-sach-api
- Sample JS chính thức: https://gitlab.com/9pay-sample/sample-javascript
- Merchant View (sandbox): https://sand-mcv2.9pay.vn
- Hướng dẫn MCV (không phải API): `docs/Hướng dẫn sử dụng MCV v2.docx`
