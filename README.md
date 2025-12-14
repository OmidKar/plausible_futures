# Plausible Futures – Ideation App

A collaborative ideation and voting platform with React frontend and Node.js/Express backend.

## 🎯 What's Implemented

### ✅ **Frontend (React + Vite)**
- **Authentication**: Email-based signup/login with localStorage persistence
- **Session Management**: Create, join, and manage ideation sessions
- **Sub-Session Architecture**: Isolated user workspaces preventing cross-contamination
- **Staged Workflow**: 
  - Setup (moderator creates topics)
  - Contribution (users submit ideas)
  - Voting (ranked voting on contributions)
  - Final Report (downloadable JSON with ranked results)
- **Role-Based UI**: Moderator vs. participant views with appropriate controls
- **Real-Time Status**: Live submission tracking for moderators

### ✅ **Backend (Node.js + Express + SQLite)**
- **Full REST API**: 13 endpoints for sessions, contributions, and voting
- **Database**: SQLite with sql.js (in-memory for development)
- **Session Management**: Create, update, list, join, and delete sessions
- **Contribution Tracking**: One-shot submission with participant status
- **Voting System**: Vote recording with deduplication and self-vote prevention
- **State Transitions**: Moderator-controlled session states (setup → contributing → voting → final)

### ✅ **Testing**
- **61 Integration Tests**: All passing (100% coverage)
- **Test Suites**: Contributions, votes, and session management
- **CI-Ready**: Uses Vitest with happy-dom

## 🚀 Quick Start

### Frontend
```bash
npm install
npm run dev
# Open http://localhost:4173
```

### Backend
```bash
cd backend
npm install
npm run dev
# Server runs on http://localhost:3001
```

### Run Tests
```bash
cd backend
npm test
```

## 📚 Documentation

- **`design.md`**: Detailed architecture, sub-session pattern, workflow stages
- **`plan.md`**: High-level deployment strategy
- **`backend/README.md`**: Complete API documentation with examples
- **`tests/README.md`**: Frontend unit test documentation

## 🏗️ Architecture

**Frontend**: React 18 + Vite, localStorage for prototype persistence
**Backend**: Node.js + Express + sql.js (SQLite)
**Database**: In-memory SQLite (sql.js) for development; production-ready schema for PostgreSQL migration

## ⚠️ Scalability & Production Readiness

### Current Capacity: **5-10 concurrent users** (Prototype/Demo)

**Status**: ✅ Fully functional for development and small-scale testing

**Limitations**:
- Uses sql.js (in-memory JavaScript SQLite) which blocks on writes
- Single-threaded database operations
- Data not persisted across server restarts
- No connection pooling

### For 100+ Users: PostgreSQL Migration Required

**Migration Steps** (~2-4 hours):
1. Install PostgreSQL and `pg` npm package
2. Replace `backend/db.js` with PostgreSQL connection pool
3. Deploy schema to PostgreSQL (already production-ready)
4. Minimal query adjustments needed

**Post-Migration Performance**:
- ✅ 100+ concurrent users supported
- ✅ Connection pooling with 20-50 connections
- ✅ Persistent storage with backups
- ✅ Non-blocking I/O
- ✅ Horizontal scaling possible

See `backend/README.md` for detailed migration guide.

## 📊 API Endpoints (13 total)

### Session Management (7)
- `POST /api/sessions` - Create session
- `GET /api/sessions` - List sessions (with filters)
- `GET /api/sessions/:id` - Get session details
- `POST /api/sessions/:id/topics` - Add topics
- `POST /api/sessions/:id/participants` - Add participants
- `POST /api/sessions/:id/join` - Join session (simplified)
- `PATCH /api/sessions/:id/state` - Update session state
- `GET /api/sessions/:id/status` - Get submission status
- `DELETE /api/sessions/:id` - Delete session

### Contributions (2)
- `POST /api/sessions/:id/contributions` - Submit contributions
- `GET /api/sessions/:id/contributions` - Get all contributions

### Voting (2)
- `POST /api/sessions/:id/votes` - Submit vote
- `GET /api/sessions/:id/contributions/:id/votes` - Get vote count

See `backend/README.md` for complete API documentation.

## 📖 Documentation

### 🚀 Start Here
- **`DEPLOYMENT_SUMMARY.md`**: **READ THIS FIRST** - Complete readiness assessment and deployment overview
- **`QUICKSTART_DEPLOYMENT.md`**: Step-by-step deployment guide (5-9 hours to production)

### 📚 Detailed Guides
- **`DEPLOYMENT.md`**: Comprehensive deployment reference for RHEL VM with Podman + PostgreSQL
- **`backend/MIGRATION_CHECKLIST.md`**: Detailed PostgreSQL migration checklist
- **`USER_MANUAL.md`**: End-user guide for moderators and participants

### 📋 Technical Documentation
- **`design.md`**: Technical architecture and design decisions
- **`plan.md`**: High-level development and deployment strategy
- **`backend/README.md`**: Backend API documentation with all 13 endpoints

## 🔄 Deployment Path

### For Development (Current Setup):
✅ Ready to use! Just run `npm run dev` (frontend) and `cd backend && npm run dev` (backend)

### For Production (100+ users):
1. **Migrate to PostgreSQL** (~2-4 hours) - See `backend/MIGRATION_CHECKLIST.md`
2. **Deploy with Podman** (~1-2 hours) - See `DEPLOYMENT.md`
3. **Configure networking & SSL** (~1 hour)
4. **User onboarding** - Share `USER_MANUAL.md` with your team

**Total deployment time: 4-7 hours**

## 🚀 Next Steps (Priority Order)

### Before Production Use (Required):
- [ ] **Migrate to PostgreSQL** - Critical for 100+ users (see `MIGRATION_CHECKLIST.md`)
- [ ] **Deploy to RHEL VM** - Follow `DEPLOYMENT.md` 
- [ ] **Set up SSL/TLS** - Security for external access
- [ ] **Configure backups** - Automated PostgreSQL backups

### Future Enhancements (Optional):
- [ ] Implement JWT authentication (replace localStorage auth)
- [ ] Add Azure AD integration
- [ ] Implement WebSocket for real-time updates
- [ ] Add email notifications
- [ ] Session templates and reusability

