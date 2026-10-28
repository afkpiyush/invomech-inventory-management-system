# INVOMECH Inventory Management System

Full-stack inventory and procurement management system for **INVOMECH PVT. LTD.**

> Manufacturer of all kind of packaging machines and Engineering solutions provider.

The project includes a React/Vite dashboard, an Express/TypeScript REST API, MySQL 8 migrations and seed data, cookie-based authentication, role-based authorization, inventory operations, low-stock automation, purchase-order workflows, goods receipts, CSV exports, audit logging, email preview support, and purchase-order PDF generation.

## Features

### Frontend

- Responsive inventory dashboard inspired by the supplied reference design
- INVOMECH logo and branding
- Collapsible desktop sidebar and mobile navigation drawer
- Light and dark themes persisted in `localStorage`
- Dashboard KPI cards and inventory activity charts
- Low-stock alert panel
- Inventory search and filtering
- INR formatting using Indian numbering conventions
- Login, session restoration, and logout UI
- Role-aware navigation
- Supplier, purchase-order, goods-received, reports, audit-log, and settings workspace navigation
- Responsive tablet and mobile layouts

### Backend

- Node.js, Express, and TypeScript REST API
- MySQL connection pool with transactional stock operations
- Zod request validation
- HTTP-only server-side session cookies
- CSRF protection for state-changing requests
- Login rate limiting
- Helmet security headers
- Server-side role authorization
- Structured API error responses
- Audit-log recording
- Scheduled low-stock evaluation
- Idempotent low-stock alert creation and resolution
- Safe email preview mode with optional SMTP delivery
- Server-side purchase-order PDF generation

### Inventory and procurement

- Product listing, creation, editing, archiving, and search
- Categories and suppliers
- Supplier-product relationships
- Stock receipts, issues, and adjustments
- Transactional stock updates with row locking
- Negative-stock prevention
- Minimum stock and reorder quantities
- Low-stock alerts and suggested reorder quantities
- Draft purchase orders
- Inventory-manager submission for approval
- Admin approval, rejection, and supplier dispatch
- Partial and complete goods receipts
- Inventory CSV export
- Admin audit-log access

## Technology stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- Recharts
- Framer Motion
- Lucide React
- Tailwind CSS

### Backend

- Node.js
- Express
- TypeScript
- MySQL 8
- `mysql2`
- Zod
- `bcryptjs`
- HTTP-only cookies
- Helmet
- Nodemailer
- PDFKit

### Testing and tooling

- Vitest
- Supertest dependencies
- Oxlint
- npm

## Project structure

```text
.
├── database/
│   ├── migrations/
│   │   └── 001_initial.sql
│   └── README.md
├── public/
│   └── invomech-logo.png
├── server/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── app.ts
│   ├── config.ts
│   ├── db.ts
│   ├── index.ts
│   └── seed.ts
├── src/
│   ├── api.ts
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   └── main.tsx
├── tests/
│   └── services.test.ts
├── .env.example
├── package.json
├── tsconfig.app.json
├── tsconfig.server.json
├── vite.config.ts
└── README.md
```

## Prerequisites

Install the following on Windows:

- Node.js 20 LTS or newer
- npm
- MySQL 8

Verify the installations:

```powershell
node --version
npm --version
mysql --version
```

## Installation

From the project directory:

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` and set the MySQL credentials before starting the API.

## Environment variables

The complete placeholder list is in [.env.example](./.env.example).

```dotenv
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=invomech_inventory
MYSQL_USER=root
MYSQL_PASSWORD=change-me

SESSION_TTL_HOURS=12

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
EMAIL_PREVIEW_MODE=true
```

Never commit `.env` or real credentials.

## Database setup

Make sure the MySQL 8 service is running, then run the migration from PowerShell:

```powershell
Get-Content .\database\migrations\001_initial.sql | mysql -u root -p
```

The migration creates the `invomech_inventory` database and these normalized tables:

- `users`
- `sessions`
- `categories`
- `products`
- `suppliers`
- `supplier_products`
- `stock_movements`
- `alerts`
- `reorder_proposals`
- `purchase_orders`
- `purchase_order_items`
- `goods_receipts`
- `notifications`
- `notification_outbox`
- `audit_logs`
- `company_settings`

## Seed development data

After running the migration:

```powershell
npm run db:seed
```

The seed is idempotent and creates exactly two supported application roles and two development accounts.

### Admin

```text
Email: admin@invomech.local
Password: Invomech@Admin123!
```

### Inventory Manager

```text
Email: manager@invomech.local
Password: Invomech@Manager123!
```

These credentials are for local development only. Change them before production deployment. Passwords are stored as bcrypt hashes; plaintext passwords are not stored in MySQL.

Seed suppliers, products, prices, and contact information are synthetic demo records. They are not verified supplier details.

## Run the application

### Run frontend and API separately

Terminal 1:

```powershell
npm run dev
```

Terminal 2:

```powershell
npm run dev:server
```

The frontend runs at:

```text
http://localhost:5173
```

The API runs at:

```text
http://localhost:4000
```

### Run both together

```powershell
npm run dev:all
```

The Vite development server proxies `/api` requests to `http://localhost:4000`.

## npm scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite frontend |
| `npm run dev:server` | Start the Express API with `tsx watch` |
| `npm run dev:all` | Start frontend and API together |
| `npm run build` | Build the frontend |
| `npm run build:server` | Type-check the server |
| `npm run preview` | Preview the frontend production build |
| `npm run db:seed` | Seed or update development data |
| `npm run lint` | Run Oxlint |
| `npm test` | Run Vitest tests |

## API reference

### Health and authentication

```text
GET  /api/health
GET  /api/auth/csrf
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

Authentication uses an HTTP-only `invomech_session` cookie. State-changing requests must send the CSRF token returned by `/api/auth/csrf` in the `x-csrf-token` header.

### Dashboard and inventory

```text
GET    /api/dashboard
GET    /api/inventory
POST   /api/inventory
PATCH  /api/inventory/:id
DELETE /api/inventory/:id
POST   /api/inventory/:id/movements
```

Supported movement types are `IN`, `OUT`, and `ADJUSTMENT`. Stock movements require a positive quantity and a reason.

### Suppliers

```text
GET  /api/suppliers
POST /api/suppliers
```

### Purchase orders

```text
GET  /api/purchase-orders
POST /api/purchase-orders
POST /api/purchase-orders/:id/submit
POST /api/purchase-orders/:id/approve
POST /api/purchase-orders/:id/reject
POST /api/purchase-orders/:id/dispatch
GET  /api/purchase-orders/:id/pdf
```

Approval, rejection, and dispatch are admin-only actions.

### Operations

```text
GET  /api/operations/categories
GET  /api/operations/goods-received
POST /api/operations/goods-received
GET  /api/operations/reports/inventory.csv
GET  /api/operations/audit-log
```

The audit log is admin-only. Goods receipts update product stock only after the receipt transaction succeeds.

## Roles and permissions

### Admin

The admin can:

- View dashboard metrics and reports
- Manage products, stock, categories, and suppliers
- View and acknowledge alerts
- Create, approve, reject, and dispatch purchase orders
- Record goods received
- Export inventory reports
- View audit logs
- Manage users and company settings

### Inventory Manager

The inventory manager can:

- View dashboard and inventory data
- Search products and suppliers
- Create and update permitted inventory records
- Record stock movements
- View low-stock alerts
- Create and submit purchase-order drafts
- Record goods received according to policy
- View inventory reports

The inventory manager cannot approve, reject, or dispatch purchase orders, manage users, change roles, or access admin-only audit functionality. These restrictions are enforced by backend middleware, not only by frontend visibility.

## Low-stock workflow

When a product quantity reaches or falls below its configured minimum:

1. The scheduled evaluator creates or updates an idempotent low-stock alert.
2. An admin notification is queued without creating duplicate daily notifications.
3. A suggested reorder quantity is calculated.
4. An inventory manager can create a purchase-order draft.
5. The inventory manager submits the draft for approval.
6. An admin approves or rejects the order.
7. An approved order can be dispatched by an admin.
8. Goods receipt updates product stock transactionally.
9. Alerts are resolved after stock recovers above the minimum.

## Email behavior

Email preview mode is enabled by default:

```dotenv
EMAIL_PREVIEW_MODE=true
```

In preview mode, no supplier email is sent. The email payload is logged for local verification.

To configure SMTP, provide the SMTP variables in `.env` and intentionally set:

```dotenv
EMAIL_PREVIEW_MODE=false
```

Do not enable real delivery with demo supplier records or development credentials.

## Purchase-order PDFs

Purchase-order PDFs are generated by the API using PDFKit and include:

- INVOMECH branding
- Purchase-order number
- Supplier name
- Line items
- Quantities
- Unit prices
- INR totals

The supplied logo is available to the frontend at [public/invomech-logo.png](./public/invomech-logo.png).

## Testing and validation

Run all available project checks:

```powershell
npm run build
npm run build:server
npm run lint
npm test
```

The current unit tests cover:

- Suggested reorder quantity calculation
- Negative stock detection

The repository still needs a live-MySQL integration test environment and Playwright browser tests for complete end-to-end coverage.

## Production checklist

Before production deployment:

- Replace all development credentials
- Use a strong MySQL password
- Set `NODE_ENV=production`
- Set a production `CLIENT_ORIGIN`
- Use HTTPS
- Ensure secure cookies are enabled
- Configure a real SMTP provider only when required
- Disable email preview mode only after SMTP verification
- Store environment variables outside source control
- Run migrations against the production database
- Review seeded demo records and remove them
- Configure backups and database monitoring
- Add CI coverage for MySQL integration and browser tests

## Troubleshooting

### MySQL connection refused

Start the MySQL 8 service and verify `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, and `MYSQL_PASSWORD` in `.env`.

### Unknown database

Run the migration again:

```powershell
Get-Content .\database\migrations\001_initial.sql | mysql -u root -p
```

### Authentication required

Request a CSRF token, log in with `credentials: 'include'`, and retain the session cookie. The browser must be allowed to send credentials to the API.

### CSRF invalid

Call `GET /api/auth/csrf` again and send the returned value in the `x-csrf-token` header for the state-changing request.

### Frontend cannot reach the API

Confirm both development processes are running:

```powershell
npm run dev
npm run dev:server
```

Then verify:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

Expected response:

```json
{"status":"ok"}
```

## Known limitations

- The dashboard is fully connected to the dashboard API, while several non-dashboard workspace screens remain lightweight workspace views.
- The add-record modal currently provides the frontend interaction foundation and should be connected to the inventory creation endpoint as the next UI enhancement.
- Complete Playwright coverage and live-MySQL integration tests are not included yet.
- SMTP retry-worker processing requires a deployment-specific background worker.
