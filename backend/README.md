# Plausible Futures - Backend API

## Quick Start

### Install Dependencies
```bash
cd backend
npm install
```

### Run Development Server
```bash
npm run dev
```

Server will start on `http://localhost:3001`

### Run Tests
```bash
npm test
```

## API Endpoints

All endpoints return JSON responses with a `success` field.

### Phase 1 - Core Flow (Voting) ✅

**Status:** Implemented & Tested

#### 1. Submit Contributions
```http
POST /api/sessions/:sessionId/contributions
Content-Type: application/json

{
  "participantId": "user@test.com",
  "participantEmail": "user@test.com",
  "participantName": "User Name",
  "submissions": [
    {
      "rowId": "r-123",
      "domain": "Finance",
      "topic": "Fraud Detection",
      "currentStatus": "Manual process",
      "minorImpact": "AI-assisted",
      "disruption": "Automated",
      "reimagination": "Reimagined",
      "submittedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "contributionsCount": 1,
  "message": "Successfully saved 1 contribution(s)"
}
```

#### 2. Get Contributions for Voting
```http
GET /api/sessions/:sessionId/contributions?state=voting
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session-123",
  "sessionState": "voting",
  "contributions": [
    {
      "id": "topic-1",
      "topic": "Fraud Detection",
      "domain": "Finance",
      "history": [
        {
          "id": "contrib-1",
          "participantId": "user@test.com",
          "author": "User Name",
          "currentStatus": "...",
          "votes": 5,
          "submittedAt": "..."
        }
      ]
    }
  ]
}
```

#### 3. Submit Vote
```http
POST /api/sessions/:sessionId/votes
Content-Type: application/json

{
  "contributionId": "contrib-1",
  "voterId": "user2@test.com"
}
```

**Response:**
```json
{
  "success": true,
  "contributionId": "contrib-1",
  "newVoteCount": 6,
  "message": "Vote recorded successfully"
}
```

### Phase 2 - Session Management ✅

**Status:** Implemented & Tested

#### 4. Create Session
```http
POST /api/sessions
Content-Type: application/json

{
  "name": "My Ideation Session",
  "moderatorId": "mod@example.com",
  "moderatorName": "Moderator Name",
  "moderatorEmail": "mod@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-abc123",
    "name": "My Ideation Session",
    "moderatorId": "mod@example.com",
    "state": "setup",
    "createdAt": "2024-12-14T..."
  }
}
```

#### 5. Add Topics to Session
```http
POST /api/sessions/:sessionId/topics
Content-Type: application/json

{
  "domain": "Healthcare",
  "topicName": "Patient Records",
  "sortOrder": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "topicId": "topic-xyz789",
    "sessionId": "session-abc123",
    "domain": "Healthcare",
    "topic": "Patient Records",
    "sortOrder": 1
  }
}
```

#### 6. Add Participants to Session
```http
POST /api/sessions/:sessionId/participants
Content-Type: application/json

{
  "participantId": "user@example.com",
  "displayName": "User Name",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Participant added successfully",
  "data": {
    "participantId": "user@example.com",
    "displayName": "User Name",
    "status": "joined",
    "joinedAt": "2024-12-14T..."
  }
}
```

#### 7. Update Session State
```http
PATCH /api/sessions/:sessionId/state
Content-Type: application/json

{
  "state": "voting"
}
```

**Valid states:** `setup`, `published`, `contributing`, `voting`, `voting_locked`, `final`

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-abc123",
    "state": "voting",
    "updatedAt": "2024-12-14T..."
  }
}
```

#### 8. Get Session Details
```http
GET /api/sessions/:sessionId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-abc123",
    "name": "My Ideation Session",
    "moderatorId": "mod@example.com",
    "state": "voting",
    "createdAt": "...",
    "topics": [
      {
        "topic_id": "topic-xyz789",
        "domain": "Healthcare",
        "topic_name": "Patient Records",
        "sort_order": 1
      }
    ],
    "participants": [
      {
        "participant_id": "user@example.com",
        "display_name": "User Name",
        "status": "submitted",
        "joined_at": "..."
      }
    ]
  }
}
```

#### 9. Get Submission Status
```http
GET /api/sessions/:sessionId/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-abc123",
    "sessionState": "contributing",
    "totalParticipants": 5,
    "submittedParticipantsCount": 3,
    "pendingParticipantsCount": 2,
    "participants": [
      {
        "participantId": "user1@example.com",
        "displayName": "User 1",
        "status": "submitted",
        "joinedAt": "...",
        "submittedAt": "..."
      },
      {
        "participantId": "user2@example.com",
        "displayName": "User 2",
        "status": "joined",
        "joinedAt": "...",
        "submittedAt": null
      }
    ]
  }
}
```

### Phase 3 - Polish ✅

**Status:** Implemented & Tested

#### 10. List Sessions
```http
GET /api/sessions
```

**Query Parameters:**
- `state` (optional) - Filter by session state
- `moderatorId` (optional) - Filter by moderator

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "session-abc123",
        "name": "My Session",
        "moderatorId": "mod@example.com",
        "state": "voting",
        "createdAt": "2024-12-14T..."
      }
    ]
  }
}
```

#### 11. Join Session (Simplified)
```http
POST /api/sessions/:sessionId/join
Content-Type: application/json

{
  "participantId": "user@example.com",
  "displayName": "User Name",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully joined session",
  "data": {
    "sessionId": "session-abc123",
    "sessionName": "My Session",
    "sessionState": "published",
    "participantId": "user@example.com",
    "displayName": "User Name",
    "status": "joined",
    "joinedAt": "2024-12-14T..."
  }
}
```

#### 12. Delete Session
```http
DELETE /api/sessions/:sessionId
```

**Response:**
```json
{
  "success": true,
  "message": "Session deleted successfully"
}
```

**Note:** Cascades to delete all topics, participants, contributions, and votes.

## Database Schema

Using SQLite with the following tables:
- `sessions` - Session metadata
- `topics` - Session topics/structure
- `session_participants` - Participant tracking
- `contributions` - User submissions
- `votes` - Vote records

Database file: `ideation.db` (created automatically)

## Testing

Tests will be located in `backend/tests/` directory.

## Environment Variables

- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/test/production)

## Architecture

- **Express.js** - Web framework
- **sql.js** - Pure JavaScript SQLite (no native compilation required)
- **CORS** enabled for frontend integration
- **Transaction-based** writes for data integrity

## ⚠️ Production Readiness & Scalability

### Current Capacity: **5-10 concurrent users** (Prototype Only)

**Why sql.js?**
- ✅ No C++ compilation required (works on Windows without Visual Studio)
- ✅ Cross-platform (works everywhere Node.js works)
- ✅ Perfect for prototyping and development
- ✅ Same SQLite features and SQL syntax
- ✅ Easy to test and iterate

**Critical Limitations:**
- ❌ Single-threaded blocking (blocks Node.js event loop)
- ❌ In-memory only (data lost on restart)
- ❌ `saveDatabase()` writes entire DB to disk after EVERY write
- ❌ No connection pooling
- ❌ No concurrent transaction support
- ❌ Memory-constrained (crashes with large datasets)

### 🚀 For 100+ Concurrent Users: Migrate to PostgreSQL

**Required for Production:**
```bash
# 1. Install PostgreSQL client
npm install pg

# 2. Update backend/db.js to use connection pool:
import pg from 'pg';
const pool = new pg.Pool({
  host: 'localhost',
  database: 'ideation',
  max: 20, // connection pool size
  idleTimeoutMillis: 30000
});

# 3. Minimal query changes (prepared statements remain the same)
# 4. Deploy to RHEL VM with persistent PostgreSQL instance
```

**Performance Improvements:**
- 🚀 100+ concurrent users supported
- 🚀 Connection pooling (20-50 connections)
- 🚀 Non-blocking I/O
- 🚀 Persistent storage with ACID guarantees
- 🚀 Horizontal scaling possible (read replicas)
- 🚀 Full-text search, indexing, and optimization

**Migration Effort:** ~2-4 hours (schema is production-ready, queries are compatible)

