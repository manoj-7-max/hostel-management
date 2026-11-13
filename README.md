# Hostel Management System

A local-first, multi-hostel management system built with Node.js, Express, PostgreSQL, React, and Vite. It supports hostel branches, building/floor/room/bed structure, role-based accounts, and branch-scoped operations.

## Project Structure

- `server.js` - Express server entry point
- `db.js` - PostgreSQL connection setup
- `.env` - backend environment variables
- `controllers/` - backend business logic
- `routes/` - backend API routes
- `middleware/` - JWT auth and role protection
- `scripts/prepareDatabase.js` - database preparation and demo-data normalization
- `scripts/migrations/` - additive, versioned PostgreSQL migrations
- `docs/implementation-plan.md` - architecture, relationship model, and phased scope
- `docs/backup-deployment.md` - local PostgreSQL backups, private file backups, health checks, and deployment notes
- `Dockerfile`, `compose.yaml`, and `Caddyfile` - single-domain public VPS deployment package
- `hostel_schema.sql` - SQL schema and sample seed data
- `frontend/` - React frontend application
- `frontend/src/` - pages, components, services, styles

## Tech Stack

- Backend: Node.js, Express.js, PostgreSQL
- Frontend: React, Vite, Axios, React Router
- Auth: JWT, bcrypt
- Styling: custom CSS, responsive dashboard UI

## Core Features

- Admin, student, parent, and staff login with JWT authentication
- No public signup flow
- Permission-controlled student and staff account creation
- Super-admin branch creation and user branch access
- Branch-scoped buildings, floors, rooms, beds, residents, fees, attendance, complaints, leave, staff, inventory, mess, and reports
- Password hashing with bcrypt
- Database-backed roles and permissions (super administrator, hostel manager, warden, accountant, security, mess manager, student, parent)
- Account lockout after repeated failed login attempts
- Per-request account status and branch-access checks
- Admin announcements broadcast to all students
- Student top-bar announcement notifications with unread state
- Room allocation and room visibility in student dashboard
- Complaint submission and complaint status management
- Leave approval, departure, return, and outside-student tracking
- Student payments with purpose such as `mess`, `hostel_fee`, `laundry`, `maintenance`, and `other`
- One-off invoices for deposits and other charges, partial payments, refunds, and printable PDF receipts
- Daily attendance with admin roll-call and private student history
- Staff directory with shift and active-roster management
- Hostel inventory tracking with stock adjustments and reorder alerts
- Admin-managed weekly mess menu
- Operations reports for occupancy, fee collection, attendance, and residents currently outside
- Parent portal with linked resident attendance, invoice, announcement, and leave history
- Meal plans, meal check-ins, staff attendance, and monthly hostel expense records
- Branch and team administration screens
- Bed-level room assignments protected against over-allocation
- Room transfers, resident checkout, released-bed reuse, and allocation history

## Authentication Rules

- Students can log in only if they already exist in the database
- Admin creates student accounts and sets the password
- Student login accepts:
  - email
  - or `student_id`
- Admin login accepts:
  - email

## Demo Data

After running the database preparation script:

- Admin login:
  - `admin@hostel.com`
  - `admin123`
- Existing student login:
  - `kimiko@example.com / student123`
  - `frenchie@example.com / student123`
  - `butcher@example.com / student123`
  - `diana@example.com / student123`
  - `becca@example.com / student123`

Students can also log in with `student_id`, for example `1 / student123`.

Parent accounts are created from Team Access with the guardian email saved on an admission. New parent and resident accounts must change their initial password at first sign-in.

## Room Demo Setup

The database preparation script creates the Main Hostel demo rooms and beds if missing. The Garden Annex is seeded by the multi-hostel migration. Preparation is transactional and preserves existing room allocations.

Sample allocations are created for the seeded students:

- Kimiko -> Room `1`
- Frenchie -> Room `2`
- Butcher -> Room `2`
- Diana -> Room `1`
- Becca -> Room `3`

Admin can allocate rooms only from the rooms stored in the database.

## Backend Environment

Create or update `.env` in the project root:

```env
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hostel_db
PORT=3000
JWT_SECRET=change_this_secret
CLIENT_ORIGIN=http://localhost:5173
ADMIN_NAME=Hostel Admin
ADMIN_EMAIL=admin@hostel.com
ADMIN_PASSWORD=admin123
DEFAULT_STUDENT_PASSWORD=student123
```

`.env.example` contains the same keys with placeholders; keep real credentials in the ignored `.env` file.

## Database Setup

1. Create a PostgreSQL database, for example `hostel_db`.
2. Run `hostel_schema.sql` once if you are setting up from scratch.
3. Run the preparation script. It applies all additive migrations first, then seeds the local demo account and data:

```bash
npm.cmd run prepare-db
```

The migration runner records applied versions in `schema_migration`. Migrations retain existing student, payment, and allocation rows.

## Running the Backend

Install backend dependencies:

```bash
npm.cmd install
```

Start the backend:

```bash
npm.cmd start
```

For development with reload:

```bash
npm.cmd run dev
```

Backend runs on:

```text
http://localhost:3000
```

## Running the Frontend

Move into the frontend folder:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm.cmd install
```

Start the frontend:

```bash
npm.cmd run dev
```

Frontend usually runs on:

```text
http://localhost:5173
```

## Important Scripts

- Backend:
  - `npm.cmd start`
  - `npm.cmd run dev`
  - `npm.cmd run prepare-db`
- Frontend:
  - `npm.cmd run dev`
  - `npm.cmd run build`

## API Endpoints

All protected requests use `Authorization: Bearer <token>`. The API resolves the active branch from `x-hostel-id`; it checks that the signed-in user has access before running branch-scoped queries. If the header is omitted, the user's first authorized branch is selected.

### Auth

- `POST /auth/login` - Login as admin, student, or parent
- `PUT /auth/reset-password` - Change the signed-in user's password
- `GET /health` - Check that the API and PostgreSQL are responding

### Students

- `GET /students/me` - Logged-in student profile
- `GET /students/me/room` - Logged-in student room details
- `POST /students` - Admin creates student account
- `GET /students` - Admin views all students
- `GET /students?page=1&limit=50&search=kimiko` - Search and page through a branch's resident list (up to 100 rows per page)
- `PUT /students/:id` - Admin updates student
- `DELETE /students/:id` - Admin deactivates a student while preserving their history

### Rooms

- `POST /rooms` - Admin adds room
- `GET /rooms` - Admin and student view rooms

### Room Allocation

- `POST /allocate-room` - Admin assigns the first available bed in a room to a branch resident
- `POST /allocate-room/transfer` - Move a resident to an available bed in another room while preserving the previous allocation
- `POST /allocate-room/:studentId/checkout` - Check out a resident, release the current bed, deactivate the account, and return outstanding-fee/deposit figures for settlement
- `GET /allocate-room/:studentId/history` - View bed allocation and release history

### Branches and access

- `GET /hostels` - List branches available to the signed-in user
- `POST /hostels` - Super administrator creates a branch with its first building and floor
- `GET /hostels/locations` - List buildings and floors in the active branch
- `POST /hostels/buildings` / `POST /hostels/floors` - Add spaces in the active branch
- `GET /users/roles` - List seeded role permissions (requires `users.manage`)
- `GET /users` / `POST /users` - View or add staff accounts in the active branch
- `PATCH /users/:id/active` - Activate or deactivate a branch user's account

### Admissions and private documents

- `GET /admissions` - List applications in the active branch
- `POST /admissions` - Record an applicant and optional guardian
- `PATCH /admissions/:id/status` - Review, waitlist, reject, or approve; approval creates a resident account and requires an initial password
- `POST /admissions/:id/documents` - Upload a PDF, JPG, or PNG file (maximum 5 MB)
- `GET /admissions/documents/:id` - Download a document after permission and branch checks
- `PUT /admissions/documents/:id/status` - Mark a document pending, verified, or rejected with an audit record

Documents are stored under the private `private_uploads/` folder, which is not exposed by Vite or Express static hosting.

### Visitors, maintenance, and notifications

- `GET /visitors` / `POST /visitors` - View the branch visitor log or register a visitor arrival
- `PATCH /visitors/:id/checkout` - Record visitor departure
- `GET /maintenance` / `POST /maintenance` - View work orders or submit a repair request
- `PATCH /maintenance/:id` - Assign staff or update work status and priority
- `GET /notifications` - Read the signed-in user's branch notifications
- `PUT /notifications/:id/read` / `PUT /notifications/read-all` - Mark notifications read

### Billing and payments

- `POST /payments` - Student or admin creates payment
- `GET /payments` - View payments
- `GET /invoices` - View branch invoices or the signed-in resident's own invoices
- `GET /invoices/fee-types` - View configured fee categories/rates
- `PUT /invoices/fee-types/:id/rate` - Set a new rate effective from the current date
- `POST /invoices/monthly` - Generate idempotent monthly invoices for active residents
- `POST /invoices` - Create a one-off invoice with line items
- `POST /invoices/:id/payments` - Record a confirmed payment and reduce its balance
- `POST /payments/:id/refunds` - Record a partial or full refund with reason and reference

### Complaints

- `POST /complaints` - Student creates complaint
- `GET /complaints` - Student views own complaints, admin views all
- `PUT /complaints/:id` - Admin updates complaint status

### Mess Menu

- `GET /menu` - View mess menu
- `POST /menu` - Admin adds a meal to the menu
- `DELETE /menu/:id` - Admin removes a meal

### Attendance

- `GET /attendance?date=YYYY-MM-DD` - Admin views a day's roll call
- `PUT /attendance` - Admin saves attendance records for a date
- `GET /attendance/me` - Student views their own recent attendance

### Staff and Inventory

- `GET /staff` - Admin views the hostel staff directory
- `POST /staff` - Admin adds a staff member
- `PATCH /staff/:id` - Admin activates or deactivates a staff member
- `GET /inventory` - Admin views stock levels
- `POST /inventory` - Admin adds an inventory item
- `PATCH /inventory/:id/quantity` - Admin adjusts item quantity

### Reports

- `GET /reports/summary` - Authorized staff view occupancy, payments, recorded monthly expenses, complaints, attendance, and outpass totals

### Parent portal

- Create a parent account from Team Access using the guardian email stored on an admission.
- `GET /parent/children` - List residents linked to the signed-in guardian
- `GET /parent/children/:studentId/attendance` - Resident attendance history
- `GET /parent/children/:studentId/invoices` - Resident invoices and balances
- `GET /parent/children/:studentId/announcements` - Branch announcements
- `GET /parent/children/:studentId/leave` - Resident leave approvals and departure/return times

### Mess, staff attendance, and expenses

- `GET/POST /mess/subscriptions` - List or start resident meal plans
- `PATCH /mess/subscriptions/:id` - Pause, resume, or end a plan
- `GET/POST /mess/attendance` - View and record date/meal check-ins (active meal plans required)
- `GET/PUT /staff-attendance` - Read/save daily staff roll call
- `GET/POST /expenses` - Read or record hostel costs, scoped to the active branch

### Outpass

- `POST /outpass/request` - Student requests outpass
- `GET /outpass` - List leave requests available to the signed-in user
- `PUT /outpass/approve/:id` - Admin approves or rejects outpass
- `PUT /outpass/checkout/:id` - Admin records checkout
- `PUT /outpass/checkin/:id` - Admin records checkin
- `GET /outpass/currently-outside` - Admin views students currently outside

### Announcements

- `GET /announcements` - Fetch announcements
- `POST /announcements` - Admin creates broadcast announcement
- `PUT /announcements/:id/read` - Student marks announcement as read

## Frontend Notes

- Login page supports role selection
- Admin dashboard includes:
  - students
  - rooms
  - complaints
  - payments
  - outpass
  - announcements
- Student dashboard includes:
  - profile
  - room details
  - complaints
  - payments with purpose
  - mess menu
  - outpass request
  - sliding announcement bar
  - attendance history

- Admin navigation also includes attendance, staff attendance, inventory, meal plans/check-ins, expense records, mess menu editing, and downloadable operations reports.
- Permission holders also see admissions, visitor register, maintenance, branch/floor controls, and staff access screens.
- Administrators with the relevant permissions also see team access and branch/building/floor administration. The login page includes the local demo credentials.

## Free public demo

The repository includes a Render Blueprint in `render.yaml` for a temporary demo deployment. Follow the [Render setup and free-tier limits](docs/backup-deployment.md#temporary-free-demo-on-render); do not store real resident or payment data on the free tier.

## Current implementation status

This is an active, phased build of the master brief. Shared accounts and permissions, two demo branches, bed-level allocation, admissions review with private documents, invoices and refunds, visitor logging, maintenance work orders, complaint history, notifications, leave tracking, parent views, meal plans/check-ins, staff attendance, expenses, and resident pagination are implemented. Applicant self-service, richer exports/reports, backup/deployment procedures, and broader concurrency/security tests remain open work. See [the implementation plan](docs/implementation-plan.md) and [verification notes](docs/verification.md) for detail.

## Changing the Background Image

To use your own background image:

1. Create `frontend/src/assets/`
2. Put your image in that folder
3. Update the `body` background in [frontend/src/styles.css](frontend/src/styles.css)

Example:

```css
url("./assets/hostel-bg.jpg")
```

## Notes

- Use `npm.cmd` in PowerShell if `npm` is blocked by execution policy
- If frontend shows stale data after backend changes, restart backend and hard refresh the browser with `Ctrl + Shift + R`
- `dist/` is generated output and should not be used for source image editing
