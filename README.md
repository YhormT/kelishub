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
GMPL_API_URL="https://api.gmpl.com"
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
const BASE_URL = import.meta.env.VITE_API_URL || 'https://kellishub.com';
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

### GMPL supplier API (upstream)

Kellishub forwards agent Excel orders to GMPL after wallet debit (`backend-main/services/gmplService.js`).

| GMPL endpoint | `POST https://api.gmpl.com/api/orders/agents/new` |
| Auth | `Authorization: Bearer <secret>` **or** `x-clerk-api-key: <secret>` (both sent) |
| Body | `multipart/form-data`: `orderFile` (`.xlsx`), `network_provider` (`mtn`, `telecel`, `airteltigo`, …) |

Direct supplier test (replace secret; do not commit real keys):

```bash
curl -X POST "https://api.gmpl.com/api/orders/agents/new" \
  -H "Authorization: Bearer YOUR_GMPL_SECRET" \
  -F "orderFile=@order.xlsx" \
  -F "network_provider=mtn"
```

**Production:** In [Render](https://dashboard.render.com) → `kellishub-api` → **Environment** → set `GMPL_API_KEY` to your GMPL secret → **Save & deploy**. Never put the live key in git or `render.yaml`.

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
| `GMPL_API_URL` | Yes for file API | Default `https://api.gmpl.com` |
| `GMPL_API_KEY` | Yes for file API | Supplier API secret (`sync: false` in Blueprint) |
| `NODE_ENV` | Yes | `production` on Render |
| `PORT` | Auto on Render | Default `5000` locally |

### Frontend (`kellishub-web`, build time)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | API origin, e.g. `https://kellishub.com` — **no trailing slash** |

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
4. Attach custom domain **`kellishub.com`** to frontend (and API if same-origin).
5. Redeploy frontend after changing `VITE_API_URL`.

`JWT_SECRET` and `CHAT_ENCRYPTION_KEY` can be auto-generated. Production URLs in Blueprint:

- `FRONTEND_URL` / `PAYSTACK_CALLBACK_URL` → `https://kellishub.com`
- `VITE_API_URL` → `https://kellishub.com`

### Post-deploy checklist

- [ ] `GET /health` returns `{ "status": "ok", ... }`
- [ ] Login as admin → `/admin` → **refresh** stays on admin (not landing page)
- [ ] Agent cart submit debits wallet; external API returns 402 when balance is low
- [ ] `GMPL_API_KEY` set on API service if using file orders
- [ ] Paystack callbacks use live frontend URL
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
