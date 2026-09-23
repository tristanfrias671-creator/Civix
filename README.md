# CIVIX — Integrated Citizen Engagement & Service Orchestration Platform

A full-stack web application for real-time citizen engagement, complaint management, and government service orchestration.

---

## Features

### Citizen Portal
- Register and log in with secure JWT authentication
- Submit Complaints, Suggestions, and Feedback with GPS location and photo attachments
- Receive a unique Tracking ID (e.g., `CIVIX-20250517-A3F9K2`) for every submission
- Track real-time status of all submissions with visual progress bars
- Receive in-app notifications when submission status changes

### Admin Panel
- Full dashboard with KPI cards: total, pending, resolved, response rate, avg resolution time
- Manage all submissions with filtering, search, and pagination
- View and update priority, department, and status — triggers automatic citizen notifications
- Interactive map (Leaflet/OpenStreetMap) with color-coded pins by status
- Analytics with quarterly bar charts and sentiment distribution pie chart
- Export PDF reports via PDFKit
- Citizen directory with submission history lookup

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Tailwind CSS, React Router v6 |
| Charts | Recharts |
| Maps | Leaflet.js + OpenStreetMap |
| Backend | Node.js + Express |
| ORM | Prisma |
| Database | MySQL (XAMPP) |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| File Uploads | Multer |
| PDF Export | PDFKit |

---

## Setup Instructions

### Prerequisites
- Node.js v18+
- XAMPP installed and running (Apache + MySQL)
- npm or yarn

### 1. Start XAMPP

Open the XAMPP Control Panel and start both **Apache** and **MySQL**.

### 2. Create the database

1. Open your browser and go to `http://localhost/phpmyadmin`
2. Click **New** on the left sidebar
3. Enter `civix` as the database name
4. Click **Create**

### 3. Configure environment

Edit `server/.env`:

```env
DATABASE_URL="mysql://root:@localhost:3306/civix"
JWT_SECRET="your-secret-key-here"
PORT=5000
CLIENT_URL="http://localhost:3000"
UPLOAD_DIR=./uploads
```

> If your MySQL root user has a password set in XAMPP, update the URL to:
> `mysql://root:YOUR_PASSWORD@localhost:3306/civix`

### 4. Install backend dependencies

```bash
cd server
npm install
```

### 5. Run Prisma migrations and seed the database

```bash
npx prisma migrate dev --name init
node prisma/seed.js
```

Or use the all-in-one command:

```bash
npm run setup
```

### 6. Start the backend server

```bash
npm run dev
```

The API will be available at `http://localhost:5000`

### 7. Install and start the frontend

Open a new terminal:

```bash
cd civix/client
npm install
npm start
```

The React app will open at `http://localhost:3000`

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@civix.gov | admin123 |
| Citizen | citizen@test.com | citizen123 |

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register | Register a new citizen |
| POST | /api/auth/login | Login and receive JWT |

### Submissions
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/submissions | Citizen | Create submission (multipart/form-data) |
| GET | /api/submissions | Any | Get submissions (admin: all, citizen: own) |
| GET | /api/submissions/:id | Any | Get single submission |
| PATCH | /api/submissions/:id | Admin | Update priority / department / status |
| GET | /api/submissions/track/:trackingId | Public | Public tracking by ID |

### Notifications
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/notifications | Get user notifications |
| PATCH | /api/notifications/:id/read | Mark as read |
| PATCH | /api/notifications/mark-all-read | Mark all as read |

### Analytics (Admin only)
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/analytics/summary | KPI summary |
| GET | /api/analytics/quarterly | Quarterly chart data |
| GET | /api/analytics/sentiment | Sentiment breakdown |
| GET | /api/analytics/citizens | Citizen list with submission counts |

### Reports (Admin only)
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/reports/pdf | Download PDF analytics report |

---

## Submission Tracking ID Format

```
CIVIX-YYYYMMDD-XXXXXX
Example: CIVIX-20250517-A3F9K2
```

## Status Lifecycle

```
PENDING → REVIEWING → IN_PROGRESS → RESOLVED
```

Each status change automatically creates a notification for the citizen.

## Color System

| Color | Hex | Usage |
|---|---|---|
| Primary Blue | #1D4ED8 | Main brand, buttons, links |
| Success Green | #16A34A | Resolved status, positive sentiment |
| Warning Yellow | #CA8A04 | In Progress status |
| Danger Red | #DC2626 | Urgent priority, negative sentiment |
| Neutral Gray | #6B7280 | Pending status |

---

## Folder Structure

```
civix/
├── client/                    # React frontend
│   ├── public/
│   └── src/
│       ├── pages/
│       │   ├── citizen/       # Register, Login, Dashboard, Submit, Track, Notifications
│       │   └── admin/         # Dashboard, Submissions, Detail, Map, Analytics, Citizens, Settings
│       ├── components/
│       │   └── common/        # StatusBadge, Spinner, CitizenNav
│       ├── context/           # AuthContext
│       ├── hooks/
│       └── utils/             # api.js (axios instance)
└── server/                    # Express backend
    ├── src/
    │   ├── controllers/       # auth, submissions, notifications, analytics, reports
    │   ├── middleware/        # auth (JWT), upload (Multer)
    │   ├── routes/            # auth, submissions, notifications, analytics, reports
    │   └── utils/             # trackingId, sentiment
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.js
    ├── uploads/               # Uploaded images
    └── index.js
```
