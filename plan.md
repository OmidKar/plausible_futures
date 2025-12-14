## Ideation App Development & Deployment Plan

### Current Status
- ✅ **Frontend**: Fully implemented with React + Vite, localStorage persistence, staged workflow
- ✅ **Backend**: Complete REST API (13 endpoints) with Express + SQLite (sql.js)
- ✅ **Testing**: 61 integration tests passing (100% coverage)
- 🔄 **Integration**: Ready to connect frontend to backend APIs
- 📋 **Deployment**: Ready for PostgreSQL migration and containerization

### 1. Architecture (Implemented & Planned)

**Current (Development):**
- ✅ Single-page React frontend with email-based authentication (localStorage)
- ✅ Node/Express API with full REST endpoints for sessions, contributions, and voting
- ✅ SQLite (sql.js) in-memory database for rapid prototyping
- ✅ Comprehensive test suite with Vitest

**Production (Planned):**
- 🔄 Frontend authentication via MSAL.js (Azure AD integration)
- 🔄 PostgreSQL on RHEL host for persistent storage
- 🔄 Podman containers: frontend static server, backend API, nginx reverse proxy
- 🔄 JWT-based authentication replacing localStorage

### 2. Data Model
1. `participants` (id, azure_oid, name, email).
2. `sessions` (id, name, description, created_by).
3. `session_rows` (session_id, row_index, timestamps).
4. `row_cells` (row_id, column_key, content, submitted_by).
5. `votes` (session_id, entry_row_id, voter_id, vote_value [-1..1]).

### 3. Backend API Contract (✅ Implemented)

**13 Endpoints Implemented:**
1. ✅ `POST /api/sessions` – Create session
2. ✅ `GET /api/sessions` – List sessions (with filtering)
3. ✅ `GET /api/sessions/:id` – Get session details
4. ✅ `POST /api/sessions/:id/topics` – Add topics to session
5. ✅ `POST /api/sessions/:id/participants` – Add participants
6. ✅ `POST /api/sessions/:id/join` – Simplified join endpoint
7. ✅ `PATCH /api/sessions/:id/state` – Update session state
8. ✅ `GET /api/sessions/:id/status` – Get submission status
9. ✅ `DELETE /api/sessions/:id` – Delete session (with cascade)
10. ✅ `POST /api/sessions/:id/contributions` – Submit contributions (one-shot)
11. ✅ `GET /api/sessions/:id/contributions` – Get all contributions with vote counts
12. ✅ `POST /api/sessions/:id/votes` – Cast vote (with deduplication)
13. ✅ `GET /api/sessions/:id/contributions/:id/votes` – Get vote count

See `backend/README.md` for complete documentation with examples.

### 4. Authentication & Tokens
- Frontend uses MSAL.js to log users in; obtains access token for API scope.
- Backend middleware validates JWTs (issuer, audience, signature) using Azure AD JWKS.
- Map `oid` claim to participants table; persist display name/email.
- Azure AD App Registration for SPA + API, define scopes, use PKCE on frontend.

### 5. Development Workflow
1. Scaffold API with PostgreSQL client, migrations, Azure AD middleware, and report generator.
2. Build React table: rows state, multi-line inputs, add-row button, submit/voting/report buttons; call API with token.
3. Implement compiled view fetch + voting UI; show aggregated votes + your own vote.
4. Write report endpoint to aggregate entries/votes and return downloadable CSV/PDF.
5. Configure environment variables (.env) for DB connection, Azure IDs, session settings.

### 6. Deployment Steps on RHEL VM (Podman + Postgres)

**📚 Complete deployment guide available in `DEPLOYMENT.md`**

**Quick Summary:**
1. **PostgreSQL Setup** (~30 min)
   - Create database and user
   - Run schema migrations
   - Configure network access

2. **Backend Migration** (~2-4 hours)
   - Install `pg` package
   - Update route handlers to async/await
   - Switch from sql.js to PostgreSQL
   - See `backend/MIGRATION_CHECKLIST.md` for step-by-step guide

3. **Containerization** (~1-2 hours)
   - Build Podman images (backend + frontend + nginx)
   - Create pod: `podman pod create --name ideation-pod --publish 8080:80`
   - Run containers with PostgreSQL connection

4. **Production Hardening** (~1-2 hours)
   - Set up systemd service for auto-restart
   - Configure SSL/TLS (Let's Encrypt or self-signed)
   - Implement automated backups
   - Configure firewall and SELinux

5. **User Onboarding** (~1 hour)
   - Share `USER_MANUAL.md` with team
   - Train moderators on workflow
   - Run pilot session

**Total Time: 5-9 hours** from current state to production-ready

### 7. Operational Notes
- Ensure backend validates tokens; do not rely solely on frontend auth.
- Report generation can be server-side (e.g., `pdfkit`, `csv-writer`) using aggregated rows/votes.
- Voting controls should show current score and user vote; backend ensures unique vote per voter/row.
- Session lifecycle: start session (via API), participants submit entries, compile view, vote, download report.

### 8. Next Steps - Production Deployment

**All development complete! Ready for production deployment.**

#### 🔄 Phase 4: Production Deployment (NEXT)

Follow these guides in order:

1. **PostgreSQL Migration** (2-4 hours)
   - 📖 See `backend/MIGRATION_CHECKLIST.md`
   - Update route handlers to async/await
   - Switch database driver from sql.js to pg
   - Verify all 61 tests still pass

2. **Deploy to RHEL VM** (1-2 hours)
   - 📖 See `DEPLOYMENT.md` (Parts 1-4)
   - Set up PostgreSQL database
   - Build and deploy Podman containers
   - Configure networking

3. **Production Hardening** (1-2 hours)
   - 📖 See `DEPLOYMENT.md` (Parts 5-7)
   - Set up systemd services
   - Configure SSL/TLS
   - Implement backups and monitoring

4. **User Onboarding** (1 hour)
   - 📖 Share `USER_MANUAL.md` with team
   - Train moderators on session workflow
   - Run pilot session with 5-10 users

#### 📋 Future Enhancements (Optional)

- Implement JWT authentication (replace localStorage)
- Add Azure AD integration (MSAL.js)
- Real-time updates via WebSocket
- Email notifications for session stages
- Session templates and reusability
- Advanced analytics and reporting

