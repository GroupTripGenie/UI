# 🧞 TripGenie

> AI-powered travel planning — plan smarter, travel better.

TripGenie is a full-stack web application that helps you plan trips end-to-end using AI. Generate itineraries, track budgets, manage checklists, set reminders, and log trip memories — all in one place.

**Live:** [tripgenie.space](https://tripgenie.space) &nbsp;·&nbsp; **Built by:** The TripGenie Team

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 AI Itinerary Generator | Generates day-by-day itineraries based on destination, dates, pace, budget, and interests |
| ✏️ Edit Before Saving | Review and edit AI-generated itineraries before committing |
| 🗺️ Interactive Map | Pin places on a Leaflet/OpenStreetMap map per trip — saved to the cloud |
| 🌤️ Live Weather | Real-time weather + trip-date forecast via Open-Meteo (no API key needed) |
| 💸 Budget Tracker | Track expenses by category with an AI spending analysis |
| 💱 Currency Converter | Live exchange rates via Frankfurter API |
| ✅ Checklists | Create and manage packing lists and custom checklists per trip |
| 🧳 AI Packing List | AI-generated packing list with inline editing before saving |
| 🔔 Reminders | Set reminders with priorities, categories, and AI-suggested dates |
| 📖 Trip Journal | Date-stamped daily log entries saved to the cloud |
| 🏷️ Trip Tags | Tag trips (Beach, Business, Family, etc.) and filter by tag |
| 📅 Calendar View | Visual calendar showing trips, itinerary activities, and reminders |
| 🎙️ Voice Input | Speak your trip details — AI extracts and fills the form |
| 📄 PDF Export | Export a full trip summary as a printable PDF |
| 🔐 Auth | Email/password + Google OAuth, JWT sessions, forgot/reset password |
| 🌙 Dark Mode | Full dark mode with deep `#0a0c10` palette |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript (no framework) |
| Backend | Node.js + Express |
| Database | PostgreSQL (Railway) |
| Auth | JWT + bcrypt + Google OAuth 2.0 |
| AI | OpenAI GPT-4o-mini |
| Email | Resend API |
| Images | Cloudinary |
| Maps | Leaflet.js + OpenStreetMap (free, no key) |
| Weather | Open-Meteo API (free, no key) |
| Currency | Frankfurter API (free, no key) |
| Geocoding | Nominatim / OpenStreetMap |
| Hosting | Render (frontend) + Railway (backend + DB) |

---

## 🗂️ Project Structure

```
UI-main/
└── tripgenie/
    ├── index.html          ← Landing page
    ├── app.html            ← Main SPA
    ├── app.js              ← All frontend logic
    ├── styles.css          ← All styles
    ├── login.html
    ├── register.html
    ├── forgot.html
    ├── reset-password.html
    ├── auth-callback.html
    ├── terms.html
    ├── privacy.html
    └── tripgenie-db/       ← Backend (Railway)
        ├── server.js
        ├── db.js
        ├── package.json
        └── routes/
            ├── auth.js
            ├── trips.js
            ├── budget.js
            ├── checklists.js
            └── assistant.js
```

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+
- PostgreSQL database
- OpenAI API key
- Resend API key (for password reset emails)
- Google OAuth credentials (optional)

### Backend

```bash
cd tripgenie/tripgenie-db
npm install
```

Create a `.env` file:
```env
DATABASE_URL=your_postgres_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=your_openai_key
RESEND_API_KEY=your_resend_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FRONTEND_URL=http://localhost:5500
```

```bash
node server.js
```

### Frontend

Open `tripgenie/app.html` in a browser, or serve with Live Server (VS Code extension).

Update the `API` constant in `app.js` to point to your local backend:
```js
const API = 'http://localhost:3000/api';
```

---

## 🗄️ Database Setup

Run these SQL commands on your PostgreSQL instance:

```sql
-- Core tables (abbreviated — full schema in db.js)
CREATE TABLE users (...);
CREATE TABLE trips (...);
CREATE TABLE budgets (...);
CREATE TABLE budget_categories (...);
CREATE TABLE expenses (...);
CREATE TABLE checklists (...);
CREATE TABLE checklist_items (...);
CREATE TABLE reminders (...);
CREATE TABLE password_reset_tokens (...);

-- Added during development
ALTER TABLE trips ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
```

---

## 🔒 Security

- Passwords hashed with bcrypt (cost factor 12)
- JWT authentication with 7-day expiry
- Rate limiting on all routes (200 req/15min global, 10 req/min on AI, 20 req/15min on auth)
- Input sanitization and length limits on all auth endpoints
- AI message capped at 8,000 characters
- HTTPS enforced via Render + Cloudflare

---

## 📸 Screenshots

> Coming soon

---

## 📄 License

This project was built as a school project by the TripGenie Team. All rights reserved.
