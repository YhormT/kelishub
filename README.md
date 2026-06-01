# kellishub — Data Package Fulfillment & Agent Management Platform

A full-stack platform for reselling mobile data bundles and airtime in Ghana. Supports MTN, Telecel (Vodafone), and AirtelTigo networks with a multi-tier agent system, real-time chat, Paystack payments, and SMS-based payment verification.

---

## Architecture

```
yhorm_railway/              # Repository root
├── railway.json           # Railway deploy config
├── backend-main/          # Node.js + Express + Prisma (MySQL) → Railway Web Service
└── frontend-main/         # React 18 + Vite + Tailwind + Socket.IO
```

---

## Tech Stack

### Backend (`backend-main/`)

| Layer | Technology |
|-------|------------|
| Runtime | Node.js, Express 4 |
| Database | **MySQL** via Prisma ORM 6 (`provider = "mysql"`) |
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
- MySQL database (Railway MySQL plugin or local)
- Paystack secret key (test or live)

### Backend

```bash
cd backend-main
npm install
```

Create `backend-main/.env` with at least:

```env
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
npx prisma generate
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

**New** → **Static Site** → same repo.

## Deployment on Railway

Deploy the **backend** as a Railway Web Service and attach the existing **MySQL** database service (keep the service name **`mysql`** in the Railway project — do not rename it).

| Item | Value |
|------|--------|
| API URL | `https://yhormpro-production.up.railway.app` |
| Database | Railway MySQL plugin — link `DATABASE_URL` from service **`mysql`** |
| Prisma provider | `mysql` (see `backend-main/prisma/schema.prisma`) |

### Backend service settings

| Setting | Value |
|---------|--------|
| **Root Directory** | `backend-main` |
| **Build Command** | `npm install && npx prisma generate` |
| **Start Command** | `node index.js` |

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | From Railway MySQL service **`mysql`** (`mysql://...`) |
| `JWT_SECRET` | Yes | Random secret |
| `CHAT_ENCRYPTION_KEY` | Yes | 32-char key or same as `JWT_SECRET` |
| `PAYSTACK_SECRET_KEY` | Yes | Paystack secret key |
| `PAYSTACK_CALLBACK_URL` | Yes | `https://<frontend-host>/shop` |
| `FRONTEND_URL` | Yes | `https://<frontend-host>` |
| `NODE_ENV` | Yes | `production` |

### Frontend (Vercel, Netlify, or Railway static)

| Variable | Notes |
|----------|-------|
| `VITE_API_URL` | `https://yhormpro-production.up.railway.app` — set at **build** time |

`public/_redirects` provides SPA fallback (`/* → /index.html`) when hosted on Netlify or similar.

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
"# kelishub" 
