# kellishub — Data Package Fulfillment & Agent Management Platform

A full-stack platform for reselling mobile data bundles and airtime in Ghana. Supports MTN, Telecel (Vodafone), and AirtelTigo networks with a multi-tier agent system, real-time chat, Paystack payments, and SMS-based payment verification.

---

## Architecture

```
yhorm_render/              # Repository root
├── render.yaml            # Render Blueprint (both services)
├── backend-main/          # Node.js + Express + Prisma (MySQL) → Render Web Service
└── frontend-main/         # React 18 + Vite + Tailwind + Socket.IO → Render Static Site
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
| Real-time | Socket.IO 4 (max 500 connections) |
| Files | Multer + SheetJS (`xlsx`) for Excel orders |
| Security | Helmet, CORS, rate limiter, AES-256-GCM chat encryption |

**Production hosting:** [Railway](https://railway.app) — API at `https://yhormpro-production.up.railway.app`

### Frontend (`frontend-main/`)

| Layer | Technology |
|-------|------------|
| Build | **Vite 8** |
| UI | React 18, Tailwind CSS 3 |
| Routing | React Router DOM 7 |
| HTTP | Axios |
| Real-time | Socket.IO Client 4 |

---

## Quick Start

### Prerequisites

- Node.js 18+
- MySQL database (Render MySQL or local)
- Paystack secret key (test or live)

### Backend

```bash
cd backend-main
npm install
```

Create `backend-main/.env` with at least:

```env
DATABASE_URL="mysql://user:password@localhost:3306/kellishub"
DATABASE_URL="mysql://user:password@localhost:3306/kellishub"
JWT_SECRET="your-secret-key"
CHAT_ENCRYPTION_KEY="your-32-char-key-or-same-as-jwt"
PAYSTACK_SECRET_KEY="sk_test_..."
PAYSTACK_CALLBACK_URL="http://localhost:5173/shop"
FRONTEND_URL="http://localhost:5173"
PORT=5000
NODE_ENV=development
```

Then:

```bash
npx prisma migrate dev   # applies prisma/migrations (MySQL)
npm run dev            # nodemon — or: npm start
```

Server listens on **port 5000** by default (`GET /health` for health checks).

### Frontend

```bash
cd frontend-main
npm install
```

Create `frontend-main/.env.local` (optional for local dev):

```env
VITE_API_URL=http://localhost:5000
```

```bash
npm start      # runs: vite
```

Dev server runs at **http://localhost:5173**. API base URL in `src/endpoints/endpoints.js`:

```js
const BASE_URL = import.meta.env.VITE_API_URL || 'https://yhormpro-production.up.railway.app';
```

For local dev, set `VITE_API_URL=http://localhost:5000` in `frontend-main/.env.local`.

---

## Backend Overview

### Architecture pattern

**Routes → Controllers → Services → Prisma → MySQL**

| Path | Role |
|------|------|
| `index.js` | Express app, Socket.IO, cron jobs, route mounting |
| `config/db.js` | Prisma client singleton with connection retry |
| `middleware/` | JWT auth, admin check, external API keys, rate limit, uploads |
| `controllers/` | 23 controllers — HTTP request/response |
| `services/` | 20 services — business logic |
| `utils/` | Cache, AES encryption, memory monitor, query optimizer |

### Wallet balance

Agent spendable balance is stored on `User.loanBalance` (historical field name). Orders debit this field; top-ups and refunds credit it.

### Database models (26 Prisma models)

| Model | Purpose |
|-------|---------|
| `User` | Agents & admins — roles, wallet (`loanBalance`), loans, suspension, storefront slug |
| `Product` | Data/airtime packages — pricing, stock, shop/agent visibility |
| `Cart` / `CartItem` | Per-user shopping cart |
| `Order` / `OrderItem` / `OrderBatch` | Orders, line items, bulk Excel export batches |
| `TopUp` | Wallet top-up records |
| `Transaction` | Financial ledger (top-ups, orders, loans, refunds) |
| `PaymentTransaction` | Paystack payment records |
| `StorefrontProduct` | Agent storefront listings with custom prices |
| `ReferralOrder` | Storefront orders + commission tracking |
| `CommissionPayout` | Commission payout batches |
| `CommissionRequest` | Agent requests for missing commissions |
| `ChatConversation` / `ChatMessage` | Admin–agent encrypted chat |
| `ShopChatConversation` / `ShopChatMessage` | Public shop customer–admin chat |
| `Announcement` / `NotificationRead` | Announcements + read tracking |
| `Complaint` | Customer complaints |
| `SmsMessage` | Incoming SMS for payment verification |
| `Upload` / `Purchase` | Uploaded Excel files and parsed rows |
| `ExternalApiKey` | Partner API keys |

Schema: `backend-main/prisma/schema.prisma`  
Migrations: `backend-main/prisma/migrations/` (MySQL; run `npx prisma migrate deploy` on Render)
### API route groups

| Group | Base path | Description |
|-------|-----------|-------------|
| Auth | `/api/auth` | Login, register, logout |
| Users | `/api/users` | CRUD, loans, refunds, suspension, profile |
| Products | `/products` | Product management, visibility, promos |
| Cart | `/api/cart` | Add/remove/clear cart |
| Orders | `/order`, `/api/order` | Submit cart, Excel, paste orders, tracking |
| Payments | `/api/payment` | Paystack init/verify/webhook, reconciliation |
| Top-ups | `/api` (topUp routes) | Wallet top-ups (Paystack + SMS) |
| Transactions | `/api` (transaction routes) | Ledger, balance sheet |
| Storefront | `/api/storefront` | Agent storefronts, referrals, commissions |
| External API | `/api/external` | Partner integration via API keys |
| Chat | `/api/chat` | Admin–agent messaging |
| Shop chat | `/api/shop-chat` | Shop customer–admin messaging |
| Announcements | `/api/announcement` | CRUD + audience targeting |
| Complaints | `/api/complaints` | Complaint management |
| SMS | `/api/sms` | Incoming SMS webhook |
| Shop | `/api/shop` | Public shop products & order tracking |
| Sales, uploads, reset, admin | `/api/sales`, uploads, etc. | Additional admin/ops endpoints |

> Some routes use `/api/...` and others use top-level paths like `/products` and `/order` — match the path the frontend calls for each feature.

### Background jobs (`index.js`)

| Job | Interval | What it does |
|-----|----------|--------------|
| Orphaned payment reconciliation | 5 min | Creates orders for successful Paystack payments missing an order |
| Shop order cleanup | 1 hr | Deletes completed public-shop orders older than 72h |
| Stale referral cleanup | 1 hr | Deletes pending referral orders older than 24h |

### Socket.IO events

- **Registry:** clients emit `register` with `userId` (agents) or `shop-chat:register` with `phone` (shop)
- **Chat:** `chat:send`, `chat:typing`, `chat:read`, `chat:delete` (+ shop-chat equivalents)
- **Push:** `new-order`, `balance-updated`, `force-logout`, product/stock updates, suspension

---

## Frontend Overview

### Roles & dashboards

| Role | `User.role` | Route | Notes |
|------|-------------|-------|-------|
| Admin | `ADMIN` | `/admin` | Full admin panel |
| User | `USER` | `/user` | Standard agent dashboard |
| Premium | `PREMIUM` | `/premium` | Amber/gold theme |
| Super Agent | `SUPER` | `/superagent` | Emerald theme |
| Normal Agent | `NORMAL` | `/normalagent` | Blue/indigo theme |
| Other | `OTHER` | `/otherdashboard` | Purple/pink theme |
| Profile | all roles above | `/profile` | Shared profile page |

### Public pages

| Route | Page |
|-------|------|
| `/` | Marketing landing |
| `/login`, `/register` | Authentication |
| `/shop` | Public data shop (Paystack checkout) |
| `/store/:slug` | Per-agent public storefront |

### Key directories

- `src/pages/` — 12 route-level screens
- `src/components/` — 32 reusable UI modules
- `src/utils/socket.js` — shared Socket.IO singleton
- `src/endpoints/endpoints.js` — API base URL

### Security (client)

- JWT + role stored in `localStorage`; sent as `Authorization: Bearer <token>`
- Inactivity logout: **30 min** (agents), **90 min** (admin), with 1-minute warning
- Admin **force-logout** via Socket.IO

---

## Environment Variables

### Backend (`backend-main/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string (`mysql://`) |
| `JWT_SECRET` | JWT signing key |
| `CHAT_ENCRYPTION_KEY` | AES-256 key for chat (falls back to `JWT_SECRET`) |
| `PAYSTACK_SECRET_KEY` | Paystack API secret |
| `PAYSTACK_CALLBACK_URL` | Post-payment redirect (e.g. `https://your-app.com/shop`) |
| `FRONTEND_URL` | Frontend origin for top-up callbacks |
| `PORT` | Server port (default `5000`; Render sets this automatically) |
| `NODE_ENV` | `development` or `production` |

### Frontend (`frontend-main/.env.local` or host env)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend origin — **required on Render** at frontend build time (e.g. `https://your-api.onrender.com`) |

If unset locally, `endpoints.js` uses `''` (same origin). Use `.env.local` for development.

---

## Running Tests

No automated tests are implemented yet.

- **Backend:** `npm test` — placeholder script
- **Frontend:** no `test` script in `package.json`

---

## Deployment on Render

Deploy **two services** plus a **Render MySQL** database from the root **`render.yaml`** Blueprint, or create them manually in the dashboard with the same settings.

> **Note:** The database provider is MySQL. Existing PostgreSQL data does not transfer automatically — use a fresh database on Render or migrate data with an ETL tool if moving from PostgreSQL.

| Service | Blueprint name | Type | Default URL |
|---------|----------------|------|-------------|
| API | `kellishub-api` | Web Service (Node) | `https://kellishub-api.onrender.com` |
| UI | `kellishub-web` | Static Site (Vite) | `https://kellishub-web.onrender.com` |

If you rename services in Render, update `VITE_API_URL`, `FRONTEND_URL`, and `PAYSTACK_CALLBACK_URL` to match the new `*.onrender.com` hostnames.

---

### Option A: Blueprint (recommended)

1. Push this repo to GitHub/GitLab.
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect the repo — Render reads **`render.yaml`** at the repo root.
4. When prompted, set secrets marked `sync: false`:
   - `DATABASE_URL` — auto-linked from Render MySQL (`kellishub-db`) when using the Blueprint
   - `PAYSTACK_SECRET_KEY` — from [Paystack](https://dashboard.paystack.com)
5. Wait for both services to build and deploy.

`JWT_SECRET` and `CHAT_ENCRYPTION_KEY` are auto-generated on first sync. `VITE_API_URL` and frontend callback URLs are wired to the default service names above.

---

### Option B: Manual dashboard setup

Create each service separately with the same settings as the Blueprint.

#### 1. MySQL database

Use **Render MySQL** (recommended — defined in `render.yaml` as `kellishub-db`) or any MySQL host. The Blueprint wires `DATABASE_URL` via `fromDatabase.connectionString`.

For manual setup, create a MySQL instance and set `DATABASE_URL` on the API service (e.g. `mysql://user:pass@host:3306/kellishub`).

#### 2. Backend — Web Service (`kellishub-api`)

**New** → **Web Service** → connect repo.

| Setting | Value |
|---------|--------|
| **Root Directory** | `backend-main` |
| **Build Command** | `npm install && npx prisma generate` |
| **Start Command** | `node index.js` |

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | `mysql://user:pass@host:3306/dbname` (or Render internal URL) |
| `JWT_SECRET` | Yes | Random secret; Blueprint can `generateValue: true` |
| `CHAT_ENCRYPTION_KEY` | Yes | 32-char key or same as `JWT_SECRET` |
| `PAYSTACK_SECRET_KEY` | Yes | Paystack secret key |
| `PAYSTACK_CALLBACK_URL` | Yes | `https://<frontend-host>/shop` |
| `FRONTEND_URL` | Yes | `https://<frontend-host>` |
| `NODE_ENV` | Yes | `production` |

### Frontend (Vercel, Netlify, or Railway static)

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_API_URL` | Yes | `https://<api-host>` — no trailing slash |

**SPA routing:** Add a rewrite so React Router works on refresh:

| Type | Source | Destination |
|------|--------|-------------|
| Rewrite | `/*` | `/index.html` |

(In the Blueprint this is already under `kellishub-web` → `routes`.)

---

### `render.yaml` reference

Full Blueprint at the repo root:

```yaml
databases:
  - name: kellishub-db
    plan: free
    databaseName: kellishub
    user: kellishub

services:
  - type: web
    name: kellishub-api
    runtime: node
    rootDir: backend-main
    plan: starter
    buildCommand: npm install && npx prisma generate && npx prisma migrate deploy
    startCommand: node index.js
    healthCheckPath: /health
    buildFilter:
      paths:
        - backend-main/**
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: kellishub-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: CHAT_ENCRYPTION_KEY
        generateValue: true
      - key: PAYSTACK_SECRET_KEY
        sync: false
      - key: PAYSTACK_CALLBACK_URL
        value: https://kellishub-web.onrender.com/shop
      - key: FRONTEND_URL
        value: https://kellishub-web.onrender.com

  - type: web
    name: kellishub-web
    runtime: static
    rootDir: frontend-main
    buildCommand: npm install && npm run build
    staticPublishPath: ./dist
    buildFilter:
      paths:
        - frontend-main/**
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_URL
        value: https://kellishub-api.onrender.com
```

| Blueprint field | Purpose |
|-----------------|--------|
| `rootDir` | Monorepo subfolder; build/start paths are relative to it |
| `buildFilter` | Only redeploy when files under that folder change |
| `healthCheckPath` | Zero-downtime deploys for the API |
| `databases` | Render MySQL; `DATABASE_URL` linked to the API automatically |
| `sync: false` | Prompt for secrets in the dashboard (not stored in Git) |
| `generateValue: true` | Auto-generate `JWT_SECRET` / `CHAT_ENCRYPTION_KEY` |
| `routes` (static) | SPA fallback for `/admin`, `/shop`, `/store/:slug`, etc. |

---

### Post-deploy checklist

1. `GET https://yhormpro-production.up.railway.app/health` → `{ "status": "ok", ... }`
2. Frontend login and API calls reach the Railway API URL
3. Paystack `PAYSTACK_CALLBACK_URL` and `FRONTEND_URL` match your live frontend host
4. Socket.IO connects to the same host as `VITE_API_URL`

1. **Render Dashboard** → static site `kellishub-web` → **Redirects/Rewrites** → add:
   - Source: `/*` → Destination: `/index.html` → Action: **Rewrite**
2. Or **sync the Blueprint** so `render.yaml` routes apply, then redeploy the frontend.
3. The build includes `frontend-main/public/_redirects` as a fallback.

After changing rewrite rules, trigger a **manual deploy** of the static site.

## Environment Variables

### Backend (`backend-main/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string (`mysql://...`) |
| `JWT_SECRET` | JWT signing key |
| `CHAT_ENCRYPTION_KEY` | AES-256 key for chat |
| `PAYSTACK_SECRET_KEY` | Paystack API secret |
| `PAYSTACK_CALLBACK_URL` | Post-payment redirect |
| `FRONTEND_URL` | Frontend origin for callbacks |
| `PORT` | Server port (Railway sets automatically) |
| `NODE_ENV` | `development` or `production` |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend origin at build time; defaults to `https://yhormpro-production.up.railway.app` |

---

## License

Proprietary — internal use.
