# IBA Campus Facility Booking System — Backend

NestJS + Supabase (PostgreSQL) REST API for the IBA Facility Booking System.

---

## Tech Stack

| Layer    | Technology              |
|----------|-------------------------|
| Backend  | NestJS (Node.js)        |
| Database | Supabase (PostgreSQL)   |
| Auth     | JWT (Bearer token)      |
| Frontend | React + Vite            |

---

## Project Structure

```
iba-booking-backend/
├── src/
│   ├── main.ts                    # Entry point
│   ├── app.module.ts              # Root module
│   ├── supabase/                  # Shared Supabase client
│   ├── auth/                      # JWT login, guards, decorators
│   ├── users/                     # User CRUD (admin)
│   ├── buildings/                 # Building CRUD
│   ├── rooms/                     # Room CRUD + availability
│   ├── bookings/                  # Booking lifecycle
│   ├── blocked-slots/             # Admin slot blocking
│   └── time-slots/                # Static time slot reference
├── supabase-schema.sql            # Run this in Supabase SQL editor
├── frontend-api-service.js        # Drop into your React src/
├── .env.example                   # Copy to .env and fill in
└── package.json
```

---

## Step 1 — Supabase Setup

1. Go to **https://supabase.com** and create a free account
2. Click **"New Project"**, give it a name (e.g. `iba-booking`), set a database password
3. Wait ~2 minutes for it to provision
4. Go to **SQL Editor** → **New Query**
5. Paste the entire contents of **`supabase-schema.sql`** and click **Run**
6. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **service_role** key (under "Project API keys" — use the secret one, NOT anon)

---

## Step 2 — Backend Setup

### Prerequisites
- **Node.js 18+** — download from https://nodejs.org (LTS version)
- After installing Node, open a terminal and verify: `node -v` and `npm -v`

### Install & Configure

```bash
# 1. Clone / navigate to the backend folder
cd iba-booking-backend

# 2. Install dependencies
npm install

# 3. Install NestJS CLI globally (only once)
npm install -g @nestjs/cli

# 4. Create your .env file
cp .env.example .env
```

Now open `.env` in any text editor and fill in:

```env
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=any-long-random-string-here
FRONTEND_URL=http://localhost:5173
```

### Run the Backend

```bash
# Development mode (auto-restarts on file changes)
npm run start:dev

# You should see:
# 🚀  IBA Booking API running at http://localhost:3000/api
```

---

## Step 3 — Frontend Setup

### Create the React project (if not already done)

```bash
npm create vite@latest iba-booking-frontend -- --template react
cd iba-booking-frontend
npm install
```

### Add the API service

Copy `frontend-api-service.js` into `src/api.js` in your React project.

### Add environment variable

Create a `.env` file in your React project root:

```env
VITE_API_URL=http://localhost:3000/api
```

### Run the Frontend

```bash
npm run dev
# Opens at http://localhost:5173
```

---

## Step 4 — Connect Frontend to Backend

In your React `App.jsx`, replace the mock data calls with the real API.

### Login

```js
import { api, setToken, setStoredUser } from './api';

// In your LoginPage component:
const handleLogin = async (erp, password) => {
  try {
    const { access_token, user } = await api.auth.login(erp, password);
    setToken(access_token);       // saves JWT to localStorage
    setStoredUser(user);          // saves user info
    onLogin(user);                // your existing state setter
  } catch (err) {
    setError(err.message);
  }
};
```

### Load Buildings

```js
import { api } from './api';

// In RequestBooking component:
useEffect(() => {
  api.buildings.list().then(setBuildings);
}, []);
```

### Submit a Booking

```js
// slot_id is the integer ID (1–7), not the label
await api.bookings.create({
  room_id: selectedRoomId,   // UUID from DB
  date:    selectedDate,     // "2025-06-10"
  slot_id: selectedSlotId,   // 1–7
  purpose: purposeText,
});
```

### Approve / Reject

```js
await api.bookings.approve(bookingId);
await api.bookings.reject(bookingId);
```

### Block Slots

```js
await api.blockedSlots.create({
  room_id:  roomId,
  date:     '2025-06-10',
  slot_ids: [1, 2, 3],      // array of slot IDs
  reason:   'Maintenance',
});
```

---

## API Reference

All routes require `Authorization: Bearer <token>` except login.

### Auth
| Method | Route            | Access | Description     |
|--------|------------------|--------|-----------------|
| POST   | /auth/login      | Public | Login, get JWT  |

### Users
| Method | Route        | Access | Description       |
|--------|--------------|--------|-------------------|
| GET    | /users       | Admin  | List all users    |
| POST   | /users       | Admin  | Create user       |
| DELETE | /users/:id   | Admin  | Delete user       |

### Buildings
| Method | Route            | Access     | Description       |
|--------|------------------|------------|-------------------|
| GET    | /buildings       | All        | List buildings    |
| POST   | /buildings       | Admin      | Add building      |
| DELETE | /buildings/:id   | Admin      | Remove building   |

### Rooms
| Method | Route                          | Access | Description           |
|--------|--------------------------------|--------|-----------------------|
| GET    | /rooms?building_id=xxx         | All    | List rooms            |
| GET    | /rooms/:id/availability?date=  | All    | Check slot availability|
| POST   | /rooms                         | Admin  | Add room              |
| DELETE | /rooms/:id                     | Admin  | Remove room           |

### Bookings
| Method | Route                    | Access       | Description         |
|--------|--------------------------|--------------|---------------------|
| GET    | /bookings?status=pending | Admin/PO     | List bookings       |
| GET    | /bookings?mine=true      | Student      | My bookings         |
| POST   | /bookings                | Student/PO   | Create booking      |
| PATCH  | /bookings/:id/approve    | Admin/PO     | Approve             |
| PATCH  | /bookings/:id/reject     | Admin/PO     | Reject              |
| PATCH  | /bookings/:id/cancel     | Owner/Admin  | Cancel              |

### Blocked Slots
| Method | Route                          | Access | Description     |
|--------|--------------------------------|--------|-----------------|
| GET    | /blocked-slots?room_id=&date=  | All    | List blocked    |
| POST   | /blocked-slots                 | Admin  | Block slots     |
| DELETE | /blocked-slots/:id             | Admin  | Unblock slot    |

### Time Slots
| Method | Route        | Access | Description         |
|--------|--------------|--------|---------------------|
| GET    | /time-slots  | All    | Get all time slots  |

---

## Demo Credentials (from seed data)

| Role           | ERP / Username | Password  |
|----------------|----------------|-----------|
| Admin          | admin          | admin123  |
| Program Office | po001          | password  |
| Student        | 12345          | password  |
| Student        | 22222          | password  |

> Passwords in the seed SQL are pre-hashed with bcrypt.
> The plaintext "password" hashes to `$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi`

---

## Running Both Together

Open **two terminals**:

```bash
# Terminal 1 — Backend
cd iba-booking-backend
npm run start:dev

# Terminal 2 — Frontend
cd iba-booking-frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.
