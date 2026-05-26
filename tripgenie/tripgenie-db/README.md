# TripGenie – Backend Setup

## Project Structure

```
tripgenie-db/
├── schema.sql          ← Run this in PostgreSQL first
├── server.js           ← Express entry point
├── db.js               ← PostgreSQL connection pool
├── package.json
├── .env.example        ← Copy to .env and fill in your values
├── middleware/
│   └── auth.js         ← JWT auth middleware
└── routes/
    ├── auth.js         ← Register, login, /me
    ├── trips.js        ← Trip CRUD
    ├── budget.js       ← Budget, categories, expenses
    └── checklists.js   ← Checklists, items, reminders
```

---

## 1. Create the Database

```bash
psql -U postgres
CREATE DATABASE tripgenie;
\q
```

Then run the schema:

```bash
psql -U postgres -d tripgenie -f schema.sql
```

---

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your DB credentials and a strong JWT secret:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tripgenie
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=some_long_random_string_here
JWT_EXPIRES_IN=7d

PORT=3000
CLIENT_URL=http://127.0.0.1:5500
```

---

## 3. Install & Run

```bash
npm install
npm run dev      # development (nodemon)
npm start        # production
```

---

## API Reference

### Auth
| Method | Endpoint | Body |
|--------|----------|------|
| POST | `/api/auth/register` | `{ email, password, full_name }` |
| POST | `/api/auth/login` | `{ email, password }` |
| GET  | `/api/auth/me` | — (JWT required) |

> All protected routes need: `Authorization: Bearer <token>`

### Trips
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET    | `/api/trips` | Optional `?status=upcoming` |
| GET    | `/api/trips/:id` | |
| POST   | `/api/trips` | `{ title, destination, start_date, end_date }` |
| PATCH  | `/api/trips/:id` | Any trip fields |
| DELETE | `/api/trips/:id` | |

### Budget
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET    | `/api/budget/:tripId` | Includes categories + live spend |
| POST   | `/api/budget/:tripId` | `{ total_amount, currency }` |
| POST   | `/api/budget/:tripId/categories` | `{ name, allocated, color }` |
| GET    | `/api/budget/:tripId/expenses` | |
| POST   | `/api/budget/:tripId/expenses` | `{ category_id, description, amount }` |
| DELETE | `/api/budget/:tripId/expenses/:expenseId` | |

### Checklists
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET    | `/api/checklists` | Optional `?tripId=xxx` |
| POST   | `/api/checklists` | `{ trip_id, title, icon }` |
| POST   | `/api/checklists/:id/items` | `{ label }` |
| PATCH  | `/api/checklists/items/:itemId` | `{ is_checked, label }` |
| DELETE | `/api/checklists/:id` | |

### Reminders
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET    | `/api/reminders` | Optional `?tripId=xxx&done=false` |
| POST   | `/api/reminders` | `{ title, remind_at, priority, trip_id }` |
| PATCH  | `/api/reminders/:id` | `{ is_done, title, remind_at, priority }` |
| DELETE | `/api/reminders/:id` | |

### Health Check
```
GET /api/health
```
