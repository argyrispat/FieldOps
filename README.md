# FieldOps — Field Service Management SaaS

Portfolio-quality multi-tenant Field Service Management platform for HVAC, plumbing, electrical, IT repair, and similar service businesses.

FieldOps lets a company manage customers, technicians, jobs, scheduling, equipment, inventory, photos, notes, and PDF service reports from one responsive web application.

---

## Features

- **Multi-tenant isolation** — every company-scoped row carries `CompanyId`; the API derives tenancy from the JWT, never from client-supplied IDs
- **RBAC** — Owner, Dispatcher, Technician with role policies on every endpoint
- **Auth** — registration, login, logout, JWT access tokens, rotating refresh tokens, `/api/auth/me`
- **Customers & service locations** — search, filter, paginate, detail with jobs/equipment history
- **Jobs workflow** — New → Scheduled → In Progress → Completed (with On Hold / Cancelled), server-validated transitions
- **Scheduling** — day/week calendar, technician filter, soft conflict warnings (configurable)
- **Technician mobile UI** — today’s jobs, start/note/photo/material/complete
- **Inventory** — materials, low-stock warnings, transactional deduction on job usage
- **Equipment & maintenance reminders** — overdue / due this week / due this month; create maintenance jobs
- **Photos** — validated uploads via `IFileStorage` (local disk; S3-ready abstraction)
- **PDF service reports** — QuestPDF professional reports on completed jobs
- **Dashboard analytics** — KPIs + Recharts (status mix, completions over time, technician workload)
- **Global search** — customers, jobs, equipment
- **Docker one-command demo** with realistic Acme Services seed data

---

## Technology stack

| Layer | Stack |
|-------|--------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod, Recharts, React Router |
| Backend | ASP.NET Core 8 Web API, C#, EF Core, FluentValidation, ASP.NET Core Identity, JWT |
| Database | PostgreSQL |
| PDF | QuestPDF |
| Infra | Docker Compose, EF migrations, env-based configuration |

---

## Architecture

```text
/
├── backend/
│   ├── FieldOps.Api/              Controllers, middleware, Program.cs
│   ├── FieldOps.Application/      DTOs, interfaces, validators, rules
│   ├── FieldOps.Domain/           Entities, enums, status transitions
│   ├── FieldOps.Infrastructure/   EF Core, Identity, auth, storage, PDF, seed
│   └── FieldOps.Tests/            Unit + integration tests
├── frontend/                      Vite React SPA
├── docker-compose.yml
├── .env.example
└── README.md
```

### Multi-tenancy

1. User authenticates; JWT embeds `company_id` and roles.
2. `ICurrentUser` / `ITenantContext` read claims only.
3. EF Core global query filters scope `TenantEntity` rows to the current company.
4. Mutations re-check ownership; technicians may only mutate assigned jobs.

### Authorization model

| Role | Capabilities |
|------|----------------|
| **Owner** | Full company access including settings and users |
| **Dispatcher** | Customers, jobs, scheduling, dashboard (no user/settings admin) |
| **Technician** | Assigned jobs only (read + mutate): status updates, notes, photos, materials, complete, reports. Customer directory, calendar, dashboard, and search are manager-only. |

---

## Privacy & Security

FieldOps is a **portfolio / demo application**. It is not intended for production use or for processing real customer personal data.

- Seeded accounts and customers use **fictional** demo data (for example `admin@acme.example`, `john.smith@example.com`).
- **Authentication** uses ASP.NET Core Identity password hashing (PBKDF2), JWT access tokens, and rotating refresh tokens that are hashed at rest.
- **Authorisation** is enforced on the API with role policies. Users cannot elevate their own role through arbitrary requests; only Owners can create users, and roles are validated server-side.
- **Multi-tenant isolation** is enforced server-side: `CompanyId` comes from the JWT, EF Core global query filters scope every tenant entity, and cross-company IDOR attempts return not found / empty results.
- Technicians are limited to **assigned jobs** for both reads and writes; company-wide customer lists and related manager APIs are blocked.
- The app does **not** intentionally collect sensitive personal data (no government IDs, dates of birth, gender, precise GPS tracking, or health data).
- **Cookies / storage:** authentication uses JWTs in `localStorage` (necessary). There are no analytics or advertising cookies. See `/privacy`, `/cookies`, `/terms`, and `/cookie-settings`.
- **Security headers** are set by the API middleware and the SPA nginx config (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP, and HSTS when the request is HTTPS).
- Client errors are user-friendly; detailed exception messages and stack traces are not returned outside Development. Passwords and JWTs are not written to application logs.
- Legal pages are **demonstration templates** with placeholders such as `[Company Name]`, `[Company Address]`, and `[Contact Email]`. They have **not** been reviewed by a lawyer.

> Before using this software commercially, the privacy policy, terms, cookie implementation, data retention practices, security configuration, and GDPR obligations should be reviewed and adapted by qualified legal/privacy professionals.

---

## Database

Core tables: `Companies`, `AspNetUsers` / roles, `RefreshTokens`, `Customers`, `ServiceLocations`, `Technicians`, `Jobs`, `JobNotes`, `JobPhotos`, `JobMaterials`, `Materials`, `Equipment`, `MaintenanceRecords`.

Indexes on frequently filtered columns (`CompanyId`, `CustomerId`, `TechnicianId`, `Status`, `ScheduledStart`, `JobNumber`). Job numbers are unique per company.

---

## API overview

| Area | Examples |
|------|----------|
| Auth | `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `GET /api/auth/me` |
| Customers | `GET/POST /api/customers`, locations under `/api/customers/{id}/locations` |
| Jobs | CRUD + `/start`, `/complete`, `/hold`, `/cancel`, `/schedule`, notes, photos, materials, `/report` |
| Schedule | `GET /api/schedule?from=&to=&technicianId=` |
| Materials / Equipment | CRUD, `/equipment/reminders`, `/equipment/{id}/maintenance-job` |
| Dashboard / Search | `GET /api/dashboard`, `GET /api/search?q=` |
| Company | `GET/PUT /api/company`, `GET/POST /api/users` (Owner) |

Swagger UI: `http://localhost:8080/swagger` (Development).

---

## Local setup

### Prerequisites

- .NET 8 SDK
- Node.js 20+
- Docker Desktop (for Compose / PostgreSQL)

### Docker

```bash
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:3000  
- API: http://localhost:8080  
- Swagger: http://localhost:8080/swagger  

---

## Demo credentials (Development seed)

Fictional Acme Services tenant (enabled when `Database:SeedDemoData` is true, default in Development):

| Role | Email | Password |
|------|-------|----------|
| Owner | `admin@acme.example` | `Demo123!` |
| Dispatcher | `dispatcher@acme.example` | `Demo123!` |
| Technician | `technician@acme.example` | `Demo123!` |

Company: **Acme Services** — seeded with fictional customers, jobs, materials, and equipment.

> Development / demo environment only. Do not use real personal data in shared instances.

---

## Recruiter walkthrough

1. Open http://localhost:3000 and sign in as `admin@acme.example` / `Demo123!`
2. Review the dashboard KPIs and charts
3. Create or open a customer; add a service location
4. Create a job; schedule and assign a technician (calendar or job schedule dialog)
5. Optionally open `/privacy`, `/cookies`, and `/terms` (footer links) to see the demo legal layer
6. Sign out; sign in as `technician@acme.example`
7. Open **My Jobs**, start the job, add a note, photo, and material
8. Complete the job
9. Generate the PDF service report
10. Return as admin and confirm dashboard stats updated
