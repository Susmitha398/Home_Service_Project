# Nest Home Services

Nest is a responsive home service booking and management app with a React frontend and Express API.

## Start the app

Open two terminals in the project directory.

**API**

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run dev
```

**Frontend**

```powershell
cd frontend/my
npm install
npm start
```

Open `http://localhost:3000`. Create a customer account to book a service. The local demo admin is `admin@nest.home` with password `admin123`; change `DEMO_ADMIN_PASSWORD` in `backend/.env` before first startup if you want a different password. The admin account is created only if it does not already exist in the data file.

Demo technicians can sign in through the same login screen: `maya@nest.home`, `noah@nest.home`, `eli@nest.home`, or `ava@nest.home`; each starts with password `tech123` (change `DEMO_TECH_PASSWORD` before first API startup). The admin can also create technician accounts with their own login email and password.

## Included features

- Customer registration, sign in and sign out, with scrypt password hashes.
- Service catalog with search, category filters, selectable task types and prices for plumbing, electrical, cleaning, AC and home care.
- Plumbing offers tap leakage repair, pipe leakage repair, washbasin installation and bathroom plumbing. Electrical includes fan installation, light repair, switchboard repair and wiring. Cleaning includes full-house, bathroom, kitchen and sofa cleaning. AC includes general service, filter cleaning, repair and installation.
- Customer booking list with assigned technician, service status, contact details and completion reviews.
- Admin overview with booking totals, requests, active visits, paid revenue and customer count.
- Technician login and assigned-work view with accept/reject, on-the-way, work-started and completed steps.
- Admin controls for customer and technician directories, service create/edit/delete, booking approval and assignment, payment status, reports and reviews.
- Optional Razorpay Checkout for UPI apps such as Google Pay and PhonePe, plus pay-after-service tracking. Online amounts are charged in INR with a one-rupee minimum.
- Responsive customer and admin screens; data refreshes from the API every five seconds.

## Data and payments

The API stores accounts, sessions and bookings in `backend/data/nest-data.json`; it creates the file on first startup and keeps it across restarts. Keep this file private and back it up. This lightweight file store suits a local single-server project. For a multi-instance deployment, move the store to a managed database and add production deployment controls.

Online checkout is optional. Copy `backend/.env.example` to `backend/.env`, then set Razorpay test or live values for `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Configure the Razorpay webhook URL as `https://your-api-host/api/payments/razorpay/webhook` and subscribe to `payment.captured`. Razorpay Checkout presents the UPI apps and other methods enabled on your merchant account; on supported mobile devices it can hand off to installed UPI apps. The server creates an INR order (minimum INR 1), verifies the Checkout signature and provider payment status, and only then records `Paid`. Without Razorpay credentials, online checkout stays disabled; pay-after-service bookings continue to work. Never put the key secret in the React app.

## API

All routes use the `/api` prefix. Health check: `GET /api/health`.

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`
- `GET /services`
- `GET /bookings`, `POST /bookings`, `PATCH /bookings/:id`
- `POST /payments/razorpay/order`, `POST /payments/razorpay/verify`, `POST /payments/razorpay/webhook`
- Admin: `GET /admin/summary`, `/admin/bookings`, `/admin/technicians`, `/admin/users`, `/admin/reports`, `/admin/services`; `POST /admin/technicians`, `POST/PATCH/DELETE /admin/services`
