# SubFlow Enterprise — Teammate Handover & Developer Guide

Welcome to **SubFlow**! This document provides complete context, environment setup instructions, architecture breakdown, and credentials for any developer or AI assistant starting fresh on this repository.

---

## 1. Quick Repository Facts
- **Repository URL**: `https://github.com/Sharukhh69/SubFlow.git`
- **Active Working Branch**: `rohith2024aiml` *(Ensure you checkout this branch!)*
- **Architecture**: Full-Stack Monorepo
  - **Backend**: NestJS 10, TypeScript, Prisma ORM 6, Neon Serverless PostgreSQL, Vitest.
  - **Frontend**: React 19, TypeScript, Vite 8, TanStack React Query v5, Recharts, Lucide-React, Sonner.
- **Backend Port**: `3000` (Global API prefix `/api`, Swagger docs at `/api/docs`)
- **Frontend Port**: `5173` (Vite dev server with automatic `/api` proxy)

---

## 2. Fresh Installation & Setup (5 Minutes)

When pulling this repository onto a fresh computer, follow these exact steps:

### Step 1: Clone & Checkout Branch
```bash
git clone https://github.com/Sharukhh69/SubFlow.git
cd SubFlow
git checkout rohith2024aiml
```

---

### Step 2: Configure Backend Environment (`backend/.env`)
Git ignores `.env` files for security. You must create `backend/.env` in the `backend/` folder:

```bash
# In SubFlow/backend/.env
DATABASE_URL="postgresql://neondb_owner:npg_W6NKbcxFpQ3S@ep-cool-block-b5480y6o-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=30&pool_timeout=30"
DIRECT_URL="postgresql://neondb_owner:npg_W6NKbcxFpQ3S@ep-cool-block-b5480y6o-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30"

JWT_SECRET=brightloop-subflow-jwt-secret-key-dev-32chars!
JWT_REFRESH_SECRET=brightloop-subflow-refresh-secret-32chars!!
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

ADMIN_EMAIL=admin@brightloop.com
ADMIN_PASSWORD=Admin@12345

SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=9c95f8a2af8df7
SMTP_PASS=926a6cf7374b4d
MAIL_FROM="Brightloop Software <noreply@brightloop.com>"

AUTO_CONFIRM_INVOICES=false
```

---

### Step 3: Install Backend Dependencies & Generate Database Client
```bash
cd backend
npm install
npx prisma generate
npm run build
npm run seed
```
*(The seed initializes the sequence counters for `SUB-000001` and `INV-2026-000001` and ensures the Super Admin account exists).*

---

### Step 4: Install Frontend Dependencies
In a new terminal:
```bash
cd frontend
npm install
```

---

## 3. Running the Project

Open two terminal tabs:

### Terminal 1: Backend Server
```bash
cd backend
npm run start:dev
```
*(Wait until you see `[NestApplication] Nest application successfully started on port 3000`)*

### Terminal 2: Frontend Client
```bash
cd frontend
npm run dev
```
*(Open your browser to `http://localhost:5173`)*

---

## 4. Test Personas & Login Credentials

The login screen features 1-click **Quick Test Personas** at the bottom of the card:

| Persona | Role | Email | Password | What They Can Access |
| :--- | :---: | :--- | :--- | :--- |
| **Super Admin** | `ADMIN` | `admin@brightloop.com` | `Admin@12345` | Full platform control: Executive Dashboard, MRR Analytics, Recurring Billing runs, Subscriptions, Invoices, Catalog & Pricing, Staff management. |
| **Staff Member** | `STAFF` | `staff1@brightloop.com` | `Staff@12345` | Quotations, Subscriptions, Invoices, Payment recording, Catalog viewing. (Billing batch execution is restricted). |
| **Customer** | `CUSTOMER` | `rohithkarthik275@gmail.com` | `Rohith@13012007` | Tenant-isolated Customer Portal (`/portal`): View active subscriptions, inspect invoices, pay via UPI/Card, print tax receipts. |

*Note: New customers can also freely register at `/register` using their own email and a password adhering to the 8+ char complexity policy.*

---

## 5. What is Implemented Up to Now (Phases 1 – 9)

Every core business scene required by the platform is functional and integrated:

### 1. Executive Financial Dashboard (`/dashboard`)
- **Key Performance Indicators**: Normalized MRR, Annualized ARR, Total Cash Collected, and Overdue Accounts Receivable (A/R).
- **60-Second Cache**: Backend reports service caches aggregate analytics in-memory for 60 seconds with an instant invalidation button.
- **Visual Charts (Recharts)**:
  - 6-Month Invoiced vs. Collected Revenue comparison bar chart.
  - A/R Aging risk buckets (`0-30`, `31-60`, `61-90`, `90+` days overdue) with color-coded risk bars.
  - Plan MRR breakdown table.

### 2. Subscriptions & Quotation Engine (`/subscriptions`)
- **5-Stage Contract Lifecycle**:
  `DRAFT` $\to$ `QUOTATION` $\to$ `CONFIRMED` $\to$ `ACTIVE` $\to$ `CLOSED` (or `PAUSED`).
- **Interactive Stepper**: Visual stepper component reflecting contract stage.
- **Quotation Generator**: Create subscriptions in 1 click from reusable quotation templates.
- **Atomic Sequences**: Guaranteed unique, zero-gap IDs (e.g. `SUB-000011`).

### 3. Automated Recurring Billing Console (`/billing` — Admin Only)
- **Concurrency Protection**: Uses Postgres `FOR UPDATE SKIP LOCKED` to prevent duplicate billing runs.
- **Simulation Mode (Dry Run)**: Calculates and audits invoices without writing to the database or advancing billing dates.
- **Production Mode**: Batch generates invoices idempotently and advances subscription next billing dates.
- **Audit Ledger**: Shows past batch runs with execution latency in milliseconds.

### 4. Invoice Ledger & Payment Collections (`/invoices`)
- **Invoice States**: `DRAFT` $\to$ `CONFIRMED` $\to$ `PAID` (or `CANCELLED`).
- **Payment Collection Progress**: Visual progress bar showing percentage collected (e.g. 0% $\to$ 100%).
- **Slide-Over Payment Drawer**: Records payments against invoices via `UPI`, `CARD`, `BANK_TRANSFER`, or `CASH`. Automatically updates status to `PAID` when balance reaches zero.
- **Printable Tax Invoice**: `GET /api/invoices/:id/print` renders a printable HTML tax invoice ready for browser PDF export.

### 5. Catalog & Pricing Matrix (`/catalog`)
- **Products & Variants**: Base sales price, cost price, and dynamic variant attributes with extra price add-ons (e.g. `Storage +₹560`).
- **Subscription Plans**: Configurable intervals (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`) with renewal, pause, and cancellation controls.
- **Tax Rules**: GST tax rules (5%, 12%, 18%, 28%).
- **Discounts**: Fixed and percentage discount rules with redemption limits and usage tracking.

### 6. Customer Self-Service Portal (`/portal`)
- **Tenant Isolation**: Customers only see their own active subscriptions, next billing renewal dates, and invoices.
- **Self-Service Checkout**: Customers can pay their own invoices directly using the payment drawer.

---

## 6. Frontend Architecture Guide (For UI Designers & Developers)

The frontend is structured to make UI styling and layout changes straightforward:

```text
frontend/src/
├── api/                  # Axios services (100% connected to backend)
│   ├── auth.api.ts
│   ├── billing.api.ts
│   ├── catalog.api.ts
│   ├── client.ts         # Axios instance + 401 JWT refresh mutex queue
│   ├── invoices.api.ts
│   ├── payments.api.ts
│   ├── reports.api.ts
│   └── subscriptions.api.ts
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx       # Collapsible sidebar, header bar, user details
│   │   └── ProtectedRoute.tsx # Role-based gatekeeper (ADMIN, STAFF, CUSTOMER)
│   └── ui/                    # Atomic & Compound UI Primitives
│       ├── Badge.tsx
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── DataTable.tsx      # Table with skeleton loaders and pagination
│       ├── Drawer.tsx         # Slide-over sheet for payment forms
│       ├── Input.tsx          # Form input with validation error states
│       ├── Modal.tsx          # Dialog popups
│       ├── Skeleton.tsx       # Shimmer loading placeholders
│       ├── StatusBadge.tsx    # Color-coded badge for invoices & subs
│       └── SubscriptionStepper.tsx # 5-step lifecycle stepper
├── contexts/
│   ├── AuthContext.tsx        # Global user session & authentication state
│   └── useAuth.ts             # useAuth() hook
├── pages/                     # Feature domain views
│   ├── auth/                  # LoginPage, RegisterPage
│   ├── billing/               # BillingPage
│   ├── catalog/               # CatalogPage (Products, Plans, Taxes, Discounts)
│   ├── dashboard/             # DashboardPage (KPIs, Recharts, Aging)
│   ├── invoices/              # InvoicesPage (Ledger, PaymentDrawer)
│   ├── portal/                # CustomerPortalPage
│   └── subscriptions/         # SubscriptionsPage (Lifecycle stepper, Quotes)
├── types/                     # Shared TypeScript interfaces & enums
├── utils/                     # formatINR, formatDate, status helpers
├── App.tsx                    # React Router configuration
├── index.css                  # CSS Variables, Design Tokens, Utility classes
└── main.tsx                   # React root entry
```

### Tips for Making UI Changes
1. **Design Tokens (`frontend/src/index.css`)**:
   - Colors, borders, typography, and card shadows are governed by CSS variables (`--bg-primary`, `--bg-surface`, `--primary`, `--border-default`). Modifying these changes the entire application's theme consistently.
2. **Component Customization (`src/components/ui/`)**:
   - Buttons, Badges, Modals, and Drawers are located in `src/components/ui/`. You can enhance them with Tailwind, icons, or custom styling without modifying business logic.
3. **Data Safety**:
   - All state management for server data uses **TanStack React Query v5**. When updating subscriptions or recording payments, mutations automatically invalidate relevant query keys (`['invoices']`, `['reports']`, `['subscriptions']`), ensuring the UI stays fresh without manual reload.

---

## 7. Verification & Testing Commands

Before pushing any UI modifications, run these commands to verify that nothing was broken:

```bash
# 1. Verify frontend builds cleanly with zero TypeScript errors
npm --prefix frontend run build

# 2. Run the frontend linter
npm --prefix frontend run lint

# 3. Verify backend test suite (all 80 tests must pass)
npm --prefix backend test
```

---

## 8. Git Workflow & Rules
- **Active Branch**: `rohith2024aiml`
- **Never push to `main` directly.** Always commit and push to `rohith2024aiml` or a feature branch.
- **Never commit `.env` files** or database credential dumps.
- Commit author: `rohith2024aiml <rohithkarthik275@gmail.com>`
