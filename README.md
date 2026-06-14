# kellishub — Data Package Fulfillment & Agent Management Platform

A full-stack platform for reselling mobile data bundles and airtime in Ghana. Supports MTN, Telecel (Vodafone), and AirtelTigo with a multi-tier agent system, wallet-based ordering, real-time chat, Paystack payments, SMS verification, and an external partner API.

**Production:** [https://kellishub.com](https://kellishub.com) on [Render](https://render.com) (see `render.yaml`).

---

## Architecture

```
kellishub/                 # Repository root
├── render.yaml            # Render Blueprint (API + static frontend + MySQL)
├── backend-main/          # Node.js + Express + Prisma → Web Service
└── frontend-main/         # React 18 + Vite + Tailwind → Static Site
```

---

## Tech Stack

### Backend (`backend-main/`)

| Layer | Technology |
|-------|------------|
| Runtime | Node.js, Express 4 |
| Database | MySQL via Prisma ORM 6 |
| Auth | JWT (`jsonwebtoken`), 7-day expiry |
| Payments | Paystack (Axios) |
| Supplier API | GMPL (`GMPL_API_URL`, `GMPL_API_KEY`) for file-based data orders |
| Real-time | Socket.IO 4 (max 500 connections) |
| Files | Multer + SheetJS (`xlsx`) for Excel orders |
| Security | Helmet, CORS, rate limiter, AES-256-GCM chat encryption |

### Frontend (`frontend-main/`)

| Layer | Technology |
|-------|------------|
| Build | Vite 8 |
| UI | React 18, Tailwind CSS 3 |
| Routing | React Router DOM 7 |
| HTTP | Axios |
| Real-time | Socket.IO Client 4 |

---

## Quick Start

### Prerequisites

- Node.js 18+
- MySQL database
- Paystack secret key (test or live)
- GMPL API key (optional — required for external file orders to supplier)

### Backend

```bash
cd backend-main
npm install
```

Create `backend-main/.env`:

```env
DATABASE_URL="mysql://user:password@localhost:3306/kellishub"
JWT_SECRET="your-secret-key"
CHAT_ENCRYPTION_KEY="your-32-char-key-or-same-as-jwt"
PAYSTACK_SECRET_KEY="sk_test_..."
PAYSTACK_CALLBACK_URL="http://localhost:5173/shop"
FRONTEND_URL="http://localhost:5173"
GMPL_API_URL="https://api.getmorepaylessdatahouse.net/api/v1"
GMPL_API_KEY="your-gmpl-secret"
PORT=5000
NODE_ENV=development
```

```bash
npx prisma generate
npx prisma db push          # or: npx prisma migrate dev
npm run dev                 # nodemon — or: npm start
```

Server listens on **port 5000** (`GET /health` for health checks).

### Frontend

```bash
cd frontend-main
npm install
```

Create `frontend-main/.env.local`:

```env
VITE_API_URL=http://localhost:5000
```

```bash
npm start    # Vite dev server → http://localhost:5173
```

API base URL (`src/endpoints/endpoints.js`):

```js
const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.kellishub.com';
```

---

## Backend Overview

**Pattern:** Routes → Controllers → Services → Prisma → MySQL

| Path | Role |
|------|------|
| `index.js` | Express app, Socket.IO, cron jobs, route mounting |
| `middleware/` | JWT auth, admin check, external API keys, rate limit, uploads |
| `controllers/` | HTTP handlers |
| `services/` | Business logic (`externalApiService.js`, `orderService.js`, `gmplService.js`, …) |
| `prisma/schema.prisma` | Database schema |

### Wallet balance

Agent spendable balance is `User.loanBalance`. Cart submit, external API orders, and Excel flows debit this field; top-ups and refunds credit it via `transactionService`.

### External Partner API (`/api/external`)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /products` | `x-api-key` or `Authorization: Bearer` | List agent products |
| `POST /orders` | API key | JSON order — **debits linked agent wallet** |
| `POST /orders/file` | API key | Excel + `network_provider` → wallet check → GMPL |
| `GET /orders/:orderId` | API key | Order status (own orders only) |
| `POST /orders/status` | API key | Bulk status (max 50 IDs) |
| `POST /admin/keys` | Admin JWT | Create key (**requires `agentId`**) |
| `GET /admin/agents` | Admin JWT | List agents for key assignment |

API keys are tied to a specific agent (`ExternalApiKey.agentId`). Orders without sufficient `loanBalance` return HTTP **402**.

### GMPL supplier API (Get More Pay Less Data House)

Kellishub submits orders via the **Agent API v1** (`gmplService.js` → `POST /agent/orders/bulk`):

- **Admin → Order Files:** Export Excel (download) or **Send to GMPL** (JSON bulk, up to 3 orders per batch)
- **External API:** `POST /api/external/orders/file` (after local wallet debit)

| Setting | Value |
|---------|--------|
| Base URL | `https://api.getmorepaylessdatahouse.net/api/v1` |
| Auth | Header `x-api-key: ak_live_…` or `ak_test_…` |
| Bulk submit | `POST /agent/orders/bulk` with `{ network, idempotencyKey, recipients[] }` |
| Webhook | `POST https://your-api/order/gmpl/webhook` — events `purchase.success`, `purchase.failed` |

Test connectivity (replace with your live key):

```bash
curl "https://api.getmorepaylessdatahouse.net/api/v1/agent/me" \
  -H "x-api-key: ak_live_YOUR_KEY"
```

**Production:** Set `GMPL_API_URL` and `GMPL_API_KEY` on Render → `kellishub-api` → **Environment** (see [Fix GMPL URL on Render](#fix-gmpl-url-on-render) below). Never commit live keys to git.

### Fix GMPL URL on Render

The old value `https://api.gmpl.com` does not exist (DNS `ENOTFOUND`). Use the supplier’s Agent API base URL instead.

1. Open [Render Dashboard](https://dashboard.render.com) and select the **`kellishub-api`** web service (not the frontend or database).
2. Go to **Environment** in the left sidebar.
3. Find **`GMPL_API_URL`**:
   - If it exists and shows `https://api.gmpl.com` (or anything other than the URL below), click **Edit** and replace it with:
   ```
   https://api.getmorepaylessdatahouse.net/api/v1
   ```
   - If it is missing, click **Add Environment Variable** → Key: `GMPL_API_URL`, Value: `https://api.getmorepaylessdatahouse.net/api/v1`.
4. Find or add **`GMPL_API_KEY`**:
   - Value: your GMPL key from the supplier (`ak_live_…` for real bulk orders; `ak_test_…` only for read-only checks like `/agent/me`).
   - Mark as **Secret** if Render offers that option.
5. *(Optional but recommended)* Add **`GMPL_WEBHOOK_SECRET`** if GMPL gave you a webhook signing secret — used to verify `X-Telecom-Signature` on `POST /order/gmpl/webhook`.
6. Click **Save Changes**. Render will redeploy the API automatically (or click **Manual Deploy** → **Deploy latest commit** if you also pushed code changes).
7. After deploy finishes, verify connectivity from your machine (replace the key):

   ```bash
   curl "https://api.getmorepaylessdatahouse.net/api/v1/agent/me" \
     -H "x-api-key: ak_live_YOUR_KEY"
   ```

   You should get JSON with your agent account (not `ENOTFOUND` or 401).

8. In Kellishub admin → **Order Files**, use **Send to GMPL** on a small test batch (up to 3 orders). The GMPL modal should show a supplier response instead of `getaddrinfo ENOTFOUND api.gmpl.com`.

**Webhook URL to register with GMPL** (after API is live):

```
https://api.kellishub.com/order/gmpl/webhook
```

Events: `purchase.success`, `purchase.failed`.

### Other API groups

| Group | Base path | Description |
|-------|-----------|-------------|
| Auth | `/api/auth` | Login, register, logout |
| Users | `/api/users` | CRUD, loans, refunds, suspension |
| Products | `/products` | Catalog, pricing, visibility |
| Cart | `/api/cart` | Add/remove/clear |
| Orders | `/order` | Submit cart, Excel upload, tracking |
| Payments | `/api/payment` | Paystack init/verify |
| Storefront | `/api/storefront` | Agent storefronts, commissions |
| Chat / Shop | `/api/chat`, `/api/shop-chat` | Messaging |
| Shop | `/api/shop` | Public shop (Paystack) |

> Some routes use `/api/...` and others top-level paths (`/products`, `/order`) — match what the frontend calls.

### Background jobs

| Job | Interval | Purpose |
|-----|----------|---------|
| Orphaned payment reconciliation | 5 min | Orders for Paystack payments missing an order |
| Shop order cleanup | 1 hr | Delete old completed shop orders |
| Stale referral cleanup | 1 hr | Delete stale pending referrals |

---

## Frontend Overview

### Roles and routes

| Role | `User.role` | Dashboard route |
|------|-------------|-----------------|
| Admin | `ADMIN` | `/admin` |
| User | `USER` | `/user` |
| Premium | `PREMIUM` | `/premium` |
| Super Agent | `SUPER` | `/superagent` |
| Normal Agent | `NORMAL` | `/normalagent` |
| Other | `OTHER` | `/otherdashboard` |
| Profile | all above | `/profile` |

Public: `/` (landing), `/login`, `/shop`, `/store/:slug`.

### Auth and routing

- JWT + role in `localStorage`; `Authorization: Bearer <token>` on API calls
- `src/utils/auth.js` — normalized role checks and dashboard redirects
- Protected routes in `App.jsx` (`PrivateRoute`)
- Inactivity logout: **30 min** (agents), **90 min** (admin)
- **SPA rewrites** in `render.yaml` for `/admin`, `/user`, etc. so refresh keeps you on the dashboard

### Key paths

- `src/pages/` — route screens (e.g. `AdminDashboard.jsx`)
- `src/components/` — UI modules (e.g. `ExternalApiKeys.jsx`)
- `src/endpoints/endpoints.js` — API base URL
- `public/_redirects` — SPA fallback for hosts that read it

---

## Environment Variables

### Backend (`kellishub-api`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL connection string |
| `JWT_SECRET` | Yes | JWT signing |
| `CHAT_ENCRYPTION_KEY` | Yes | Chat encryption (or same as `JWT_SECRET`) |
| `PAYSTACK_SECRET_KEY` | Yes | Paystack secret |
| `PAYSTACK_CALLBACK_URL` | Yes | e.g. `https://kellishub.com/shop` |
| `FRONTEND_URL` | Yes | e.g. `https://kellishub.com` |
| `GMPL_API_URL` | Yes for GMPL | Default `https://api.getmorepaylessdatahouse.net/api/v1` |
| `GMPL_API_KEY` | Yes for GMPL | `ak_live_…` or `ak_test_…` from GMPL (secret in Render) |
| `NODE_ENV` | Yes | `production` on Render |
| `PORT` | Auto on Render | Default `5000` locally |

### Frontend (`kellishub-web`, build time)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Node API host (`https://api.kellishub.com`) — **not** the static site URL |

---

## Deployment on Render

Deploy from root **`render.yaml`** (Blueprint) or mirror settings manually.

| Service | Name | Type |
|---------|------|------|
| API | `kellishub-api` | Web Service (Node) |
| UI | `kellishub-web` | Static Site (Vite → `dist`) |
| DB | `kellishub-db` | Render MySQL |

### Blueprint steps

1. Push repo to GitHub/GitLab.
2. Render Dashboard → **New** → **Blueprint** → connect repo.
3. Set dashboard secrets: `PAYSTACK_SECRET_KEY`, `GMPL_API_KEY`.
4. Attach custom domain **`kellishub.com`** to the **frontend** static site.
5. Set **`VITE_API_URL`** on `kellishub-web` to `https://api.kellishub.com` (if not using Blueprint default), then redeploy the frontend.
6. In Paystack Dashboard → Webhooks, set **one** URL: `https://api.kellishub.com/api/payment/webhook` (handles shop orders and wallet top-ups).

`JWT_SECRET` and `CHAT_ENCRYPTION_KEY` can be auto-generated. Production URLs in Blueprint:

- `FRONTEND_URL` / `PAYSTACK_CALLBACK_URL` → `https://kellishub.com`
- `VITE_API_URL` (frontend build) → `https://api.kellishub.com`

### Post-deploy checklist

- [ ] `GET /health` returns `{ "status": "ok", ... }`
- [ ] Login as admin → `/admin` → **refresh** stays on admin (not landing page)
- [ ] Agent cart submit debits wallet; external API returns 402 when balance is low
- [ ] `GMPL_API_KEY` set on API service if using file orders
- [ ] Paystack callbacks use live frontend URL; webhook points at `https://api.kellishub.com/api/payment/webhook`
- [ ] `VITE_API_URL` on frontend points at API host (not `kellishub.com` unless API is proxied there)
- [ ] Revoke old external API keys without `agentId`; create new per-agent keys in admin UI

### SPA routing on Render

`render.yaml` includes rewrites for `/login`, `/admin`, `/user`, `/shop`, `/store/*`, and `/*` → `/index.html`. Sync the Blueprint or copy routes in the static site dashboard, then redeploy.

---

## Running Tests

No automated test suite yet. Backend `npm test` is a placeholder.

---

## Internal documentation

A technical investigation of the original codebase (wallet/API issues and remediation) may be kept locally as `INVESTIGATION.md` (gitignored) with PDF export via:

```bash
node scripts/generate-investigation-pdf.js
```

---

## License

Proprietary — internal use.
