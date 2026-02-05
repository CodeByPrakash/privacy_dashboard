# Privacy Dashboard

Student privacy and security dashboard built with Next.js and MySQL. The app includes a student portal, an admin console, and a Chrome extension that logs student browsing activity for safety scoring.

## Features
- Student portal with privacy score, activity history, and security updates.
- Admin console for student oversight, site blocking, and agent controls.
- Agent workflows (Guardian, Sleuth, Enforcer) backed by MySQL stored procedures.
- Chrome extension for URL logging and blocked-site updates.

## Tech Stack
- Next.js 14 (App Router)
- React 18, MUI
- MySQL 8
- Chrome extension (Manifest V3)

## Requirements
- Node.js 18+ (or 20+ recommended)
- MySQL 8.0

## Quick Start
1. Install dependencies:
	```bash
	npm install
	```
2. Create a MySQL database (example name: `privacy_dashboard`).
3. Run the SQL files in order:
	```sql
	SOURCE db/schema.sql;
	SOURCE db/views.sql;
	SOURCE db/stored_procedures.sql;
	SOURCE db/events.sql;
	```
	Note: `db/events.sql` enables the MySQL event scheduler.
4. Create a `.env` file in the project root (see the template below).
5. Start the dev server:
	```bash
	npm run dev
	```
6. Open http://localhost:3000.

## Environment Variables
Create a `.env` file in the project root:
```bash
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=privacy_dashboard
DB_POOL_SIZE=10

JWT_SECRET=replace-with-a-long-random-string
ADMIN_INVITE_CODE=your-admin-invite-code
EXTENSION_API_KEY=your-extension-api-key
```

## App Routes
- Student signup: `/auth/register`
- Admin signup: `/auth/register-admin` (requires `ADMIN_INVITE_CODE`)
- Sign in: `/auth/signin`
- Student dashboard: `/student`
- Admin dashboard: `/admin`

## API Overview
The API is implemented with Next.js route handlers under `app/api`.

Auth
- `POST /api/auth/register` - student registration
- `POST /api/auth/register-admin` - admin registration (invite code required)
- `POST /api/auth/login` - login and session cookie
- `POST /api/auth/logout` - revoke session
- `GET /api/auth/me` - current user
- `GET/POST /api/auth/extension-token` - generate or fetch a student extension token

Activity and security
- `POST /api/activity/log` - log and check a URL (student session)
- `POST /api/activity/log-extension` - log a URL from the extension
- `POST /api/activity/clear-recent` - clear last 24h activity (student)
- `POST /api/security/update` - change student password
- `POST /api/guardian/vibe-check/[studentId]` - recalc score for a student
- `POST /api/guardian/vibe-check-all` - recalc scores for all students

Admin
- `POST /api/admin/web-filter/update` - add or update web filter entries
- `POST /api/admin/students/[id]/clear-activity` - clear activity + history
- `GET /api/web-filter/blocked` - blocked list for extension (requires `x-extension-key`)

## Chrome Extension
The extension lives in the `extension/` folder.

Load in Chrome
1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click **Load unpacked**.
4. Select the `extension` folder.

Configure
Open the extension options and set:
- API Base URL (e.g. `http://localhost:3000`)
- Extension API Key (from `.env` as `EXTENSION_API_KEY`)
- Student ID (value of `students.student_id`)

The extension sends URL logs to `POST /api/activity/log-extension` and fetches the blocked list from `GET /api/web-filter/blocked`.

## Database Notes
- Scores and security levels are updated by stored procedures like `sp_guardian_vibe_check`.
- Scheduled events run periodic scans and score refreshes (see [db/events.sql](db/events.sql)).

## Scripts
- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - start production server
- `npm run lint` - lint

## Troubleshooting
- If you see 403 responses in admin routes, confirm your user has role `admin` or `super-admin`.
- If the extension cannot log data, verify `EXTENSION_API_KEY` and the API Base URL.
- MySQL event scheduler must be enabled for scheduled jobs to run.

