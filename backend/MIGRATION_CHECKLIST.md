# PostgreSQL Migration Checklist

## 🎯 Goal: Migrate from sql.js to PostgreSQL for 100+ user support

**Estimated Time:** 2-4 hours  
**Complexity:** Medium  
**Required:** Before any production deployment with 20+ concurrent users

---

## ✅ Pre-Migration Checklist

- [ ] PostgreSQL 12+ installed on RHEL VM
- [ ] Database created (`ideation`)
- [ ] User created with proper permissions (`ideation_app`)
- [ ] Network connectivity verified (test from container/app server)
- [ ] Backup of current sql.js database (if any data exists)
- [ ] Node.js 18+ available for building

---

## 📋 Migration Steps

### Step 1: Install PostgreSQL Driver ✅
```bash
cd backend
npm install pg
```

### Step 2: Create PostgreSQL Database Module ✅

Create `backend/db-postgres.js` (see DEPLOYMENT.md for full code):

**Key changes from sql.js:**
- Connection pooling (20 connections)
- Async/await for all operations
- Proper error handling
- Health checks

### Step 3: Update Route Handlers ⚠️

**All route files need async/await updates:**

#### Files to update (7 files):
- [ ] `backend/routes/sessions.js`
- [ ] `backend/routes/contributions.js`
- [ ] `backend/routes/votes.js`

#### Changes needed in EACH route handler:

**Before (sql.js - synchronous):**
```javascript
router.get('/api/sessions/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(session);
});
```

**After (PostgreSQL - asynchronous):**
```javascript
router.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(session);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});
```

**Required changes:**
1. Add `async` to route handler: `router.METHOD(path, async (req, res) => {`
2. Add `await` before all `db.prepare()...get()`, `.run()`, `.all()` calls
3. Add `await` before all `db.exec()` calls
4. Wrap in try/catch for error handling
5. Remove manual transaction BEGIN/COMMIT (use PostgreSQL transactions)

#### Detailed checklist for each file:

**sessions.js** (~9 route handlers):
- [ ] `POST /api/sessions` - Add async/await
- [ ] `GET /api/sessions` - Add async/await
- [ ] `POST /api/sessions/:sessionId/join` - Add async/await
- [ ] `DELETE /api/sessions/:sessionId` - Add async/await
- [ ] `POST /api/sessions/:sessionId/topics` - Add async/await
- [ ] `POST /api/sessions/:sessionId/participants` - Add async/await
- [ ] `PATCH /api/sessions/:sessionId/state` - Add async/await
- [ ] `GET /api/sessions/:sessionId` - Add async/await
- [ ] `GET /api/sessions/:sessionId/status` - Add async/await

**contributions.js** (~2 route handlers):
- [ ] `POST /api/sessions/:sessionId/contributions` - Add async/await, fix transaction
- [ ] `GET /api/sessions/:sessionId/contributions` - Add async/await

**votes.js** (~2 route handlers):
- [ ] `POST /api/sessions/:sessionId/votes` - Add async/await, remove manual transaction
- [ ] `GET /api/sessions/:sessionId/contributions/:contributionId/votes` - Add async/await

### Step 4: Update Database Import ✅

In all route files, change:
```javascript
import db from '../db.js';
```

To:
```javascript
import db from '../db-postgres.js';
```

Or create a config-based switcher:
```javascript
const dbModule = process.env.DB_TYPE === 'postgres' ? '../db-postgres.js' : '../db.js';
import db from dbModule;
```

### Step 5: Update Environment Variables ✅

Create `backend/.env.production`:
```bash
NODE_ENV=production
PORT=3001

# PostgreSQL Configuration
DB_HOST=host.containers.internal
DB_PORT=5432
DB_NAME=ideation
DB_USER=ideation_app
DB_PASSWORD=your_secure_password_here

# CORS
CORS_ORIGIN=http://your-vm-ip:8080
```

### Step 6: Run Database Migrations ✅

```bash
# Run schema migration
PGPASSWORD='your_password' psql -h localhost -U ideation_app -d ideation -f backend/migrations/001_initial_schema.sql

# Verify tables created
PGPASSWORD='your_password' psql -h localhost -U ideation_app -d ideation -c "\dt"
```

### Step 7: Update Tests ⚠️

**Option A: Use PostgreSQL for tests (recommended)**
```javascript
// In backend/tests/setup.js
import db from '../db-postgres.js';  // Use real PostgreSQL
```

**Option B: Keep sql.js for tests**
```javascript
// Keep tests fast with in-memory DB
import db from '../db.js';  // sql.js for tests only
```

### Step 8: Test Backend Locally ✅

```bash
# Start PostgreSQL (if not running)
sudo systemctl start postgresql

# Load environment variables
export $(cat backend/.env.production | xargs)

# Start backend
cd backend
npm start

# Test health endpoint
curl http://localhost:3001/health

# Test API
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Session","moderatorId":"test@example.com"}'
```

### Step 9: Verify Performance ✅

**Load testing** (optional but recommended):
```bash
# Install load testing tool
npm install -g autocannon

# Test session creation (100 requests)
autocannon -c 10 -d 10 -m POST \
  -H "Content-Type: application/json" \
  -b '{"name":"Load Test","moderatorId":"test@example.com"}' \
  http://localhost:3001/api/sessions

# Expected: <100ms avg response time, 0 errors
```

---

## 🔄 Rollback Plan

If issues arise after migration:

### Quick Rollback to sql.js:
```bash
# 1. Change imports back
sed -i 's/db-postgres.js/db.js/g' backend/routes/*.js

# 2. Remove async/await (restore from git)
git checkout backend/routes/

# 3. Restart server
npm start
```

### Keep both options available:
```javascript
// In backend/db-loader.js (create this)
const usePostgres = process.env.USE_POSTGRES === 'true';
export { default } from usePostgres ? './db-postgres.js' : './db.js';

// In routes:
import db from '../db-loader.js';
```

---

## 📊 Performance Comparison

| Metric | sql.js (Current) | PostgreSQL (After Migration) |
|--------|------------------|------------------------------|
| Max concurrent users | 5-10 | 100-500+ |
| Write latency | 100-500ms (blocking) | 5-20ms (non-blocking) |
| Concurrent writes | ❌ Serialized | ✅ 20+ simultaneous |
| Connection pooling | ❌ No | ✅ Yes (configurable) |
| Persistence | ❌ Memory only | ✅ Disk with WAL |
| Crash recovery | ❌ Data lost | ✅ ACID guarantees |
| Horizontal scaling | ❌ No | ✅ Read replicas |
| Memory usage | High (all in RAM) | Low (disk-backed) |

---

## 🎯 Success Criteria

After migration, verify:

- [ ] All 61 tests pass with PostgreSQL backend
- [ ] Health endpoint returns 200
- [ ] Can create session via API
- [ ] Can submit contributions
- [ ] Can cast votes
- [ ] Data persists after server restart
- [ ] Load test shows <100ms avg response time
- [ ] No errors in PostgreSQL logs
- [ ] Connection pool stats look healthy

**Query to check pool health:**
```sql
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE datname = 'ideation' AND state = 'active';
```

---

## 📝 Migration Estimate Breakdown

| Task | Time | Complexity |
|------|------|------------|
| Install pg & create db-postgres.js | 30 min | Easy |
| Update route handlers (async/await) | 60-90 min | Medium |
| Test locally | 30 min | Easy |
| Fix any issues | 30-60 min | Medium |
| Deploy to VM | 30 min | Easy |
| **Total** | **2-4 hours** | **Medium** |

**Blockers:**
- None! Your schema and queries are already PostgreSQL-compatible
- All SQL is standard (no sql.js-specific features used)

---

## 🚀 Post-Migration Improvements (Optional)

After PostgreSQL is working:

1. **Connection pooling tuning**: Adjust `max` based on load
2. **Prepared statements**: Use `pg.prepare()` for frequently-used queries
3. **Read replicas**: Add read-only replicas for GET endpoints
4. **Caching**: Add Redis for session state and vote counts
5. **Full-text search**: Add GIN indexes for searching contributions
6. **Partitioning**: Partition by session_id for very large datasets

---

## Need Help?

**Common Issues:**

1. **Connection refused**: Check PostgreSQL is running and listening
2. **Authentication failed**: Verify pg_hba.conf allows connections
3. **Permission denied**: Grant privileges on all tables and sequences
4. **Port conflict**: Ensure PostgreSQL port 5432 is available

**Verification Commands:**
```bash
# PostgreSQL status
sudo systemctl status postgresql

# Test connection
PGPASSWORD='password' psql -h localhost -U ideation_app -d ideation -c "SELECT 1;"

# Check logs
sudo tail -f /var/lib/pgsql/data/log/postgresql-*.log
```

