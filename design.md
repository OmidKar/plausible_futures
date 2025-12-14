## Ideation App Detailed Design

### 🎯 Core Architecture: Sub-Session Pattern

**Key Design Decision**: Sub-sessions are **ephemeral frontend isolation patterns**, not persistent database entities.

**Flow Summary:**
1. **Moderator** creates session template (topics/structure) → publishes
2. **Users** join session → each gets isolated sub-session in user-specific localStorage
3. **Contribution Phase**: Users work independently in their sub-session (zero cross-contamination)
4. **Submit**: One-shot POST to API → sub-session cleared → contributions saved to DB
5. **Voting Phase**: Moderator enables voting → frontend fetches all contributions from DB → reconstructs as cards
6. **Final Report**: Aggregated view from database (ranked by votes)

**Benefits:**
- ✅ Complete isolation during contribution (no leftover drafts)
- ✅ Simple state management (no cross-tab sync)
- ✅ Clean separation: ephemeral frontend state → persistent backend state
- ✅ Stateless voting (reconstructed from DB)

---

### 1. Authentication Flow (step 1: signup + login)

- Landing page shows a short explainer plus both “Sign up with email” and “Already have an account? Sign in” options.
- Sign-up form fields:
  - Email address (required, validated format).
  - Password (required, minimum 12 characters, at least one uppercase/lowercase/digit).
  - Confirm password (must match).
  - Optional display name (used when showing contributions).
- Provide inline validation feedback and a password strength meter.
- On success, show a confirmation message (“Welcome! Check your inbox if we verify, otherwise you’re ready to log in”). Optionally send activation email later.
- On submit, call `/api/auth/signup`.

#### 1.2 Sign-up API
- Endpoint: `POST /api/auth/signup`.
- Body:
  ```json
  { "email": "...", "password": "...", "displayName": "..." }
  ```
- Server actions:
  - Trim/lowercase email, reject if already registered.
  - Validate password strength server-side.
  - Hash password with `bcrypt` (cost ~12) before persisting.
  - Insert into `participants` table with `azure_oid` null/blank and `email_verified` false.
  - Return 201 with minimal profile info.
  - Optionally queue a verification email later (optional).

- Login screen reuses email+password fields with “Submit” button.
- Returning users land directly on the login tab (email prefilled if remembered) so they can jump straight into the ideation table.
- On success, return a JWT (signed by backend) containing `participantId`, `email`, `displayName`.
- Frontend stores token in memory or secure storage (e.g., `sessionStorage`) and attaches `Authorization: Bearer <token>` to API calls.
- Provide "Remember me" checkbox to persist login in localStorage via silent refresh logic (refresh token endpoint).
- **Password Reset**: Postponed for initial implementation due to email infrastructure complexity in enterprise VM environment. Will be implemented later with SMTP relay or manual admin reset workflow.

#### 1.4 Login API
- Endpoint: `POST /api/auth/login`.
- Body: `{ "email": "...", "password": "..." }`.
- Server:
  - Lookup participant by email.
  - Compare password via `bcrypt.compare`.
  - If valid, issue JWT (exp 1h) plus optional refresh token.
  - Track last login timestamp.
- Response: `{ "token": "...", "participant": {...} }`.

#### 1.5 Auth middleware (future steps)
- Protect `sessions`, `entries`, `votes`, `report` endpoints by validating JWT against secret.
- Middleware extracts `participantId` and attaches to request context.
- Later, allow Azure AD login to coexist by mapping Azure tokens to same participant records when email matches (merge strategy).

### 2. Data model changes (for auth)
- `participants` table adds columns:
  - `password_hash TEXT`
  - `email_verified BOOLEAN DEFAULT FALSE`
  - `last_login TIMESTAMPTZ`
  - `signup_method TEXT` (`local` vs `azure`)
- **Participant ID Strategy**: 
  - **Current Implementation**: Uses email address (lowercased) as stable `participantId` identifier.
  - **Backend Implementation**: Will use UUID primary key in database, but email remains unique identifier for lookups and JWT claims.
  - Each entry tracks `participantId` to identify who submitted what, enabling report generation with participant attribution.

### 3. UX states
- Default landing shows “Sign up” and “Log in” tabs.
- After login, redirect to main ideation table view with session selector.
- Provide ability to sign out (clear token + redirect to login).

### 4. Next steps
1. Wire signup/login UI components with formik/react-hook-form + validation.
2. Implement auth routes in API plus JWT issuance logic.
3. Add secure storage for tokens and auto-refresh tokens later.
4. Once auth works, continue designing table interactions + compiled view details in subsequent sections.

### 5. Session workflow & table structure

#### 5.1 Roles and session setup (Implemented)
- Each session has one moderator who creates the session and configures the table scope (domain/topic) before the group begins.
- Participants log in and join the session using the session ID; their `participantId` (email-based) is used for contributions/votes.
- Moderator creates session with a name; system generates unique session ID (format: `session-{timestamp}-{random}`).
- Participants join by entering the session ID in the "Join Session" interface.
- Session metadata tracks moderator, participants list, creation time, and all contributions.
- **Current Implementation**: Uses localStorage for prototype; backend will use PostgreSQL with JWT authentication.

#### 5.2 Table columns overview
- Two “identity” columns that are defined first:
  1. `Domain` – general area (finance, manufacturing, health, etc.); can be the same for all rows in a session.
  2. `Topic` – unique per row and defined by participants; e.g. “Money in / Money out”, “Invoice handling”, “Fraud detection”.
- After domains/topics are authored by the moderator/group, the rest of the columns capture ideation details:
  3. `Current status` – free-text description of how the topic is handled today.
  4. `Minor impact by AI` – short/long text describing incremental improvements.
  5. `Disruption by AI` – text about transformative changes or risks.
  6. `Reimagination by AI` – text describing bold reimagined workflows.

#### 5.3 Sub-Session Architecture (Design Decision)

**Concept: Ephemeral Frontend Isolation Pattern**

A "sub-session" is not a persistent database entity, but rather a **temporary working space** for each participant's contributions. It exists only during the contribution phase and is discarded after submission.

**Key Principles:**
1. **Complete Isolation**: Each user's sub-session is stored in user-specific localStorage (no cross-contamination)
2. **Ephemeral State**: Sub-session exists only during contribution; cleared immediately after submission
3. **One-Shot Submission**: No periodic auto-saves; single POST to API on submit button click
4. **Voting Reconstruction**: Voting view is built fresh from database (no dependency on sub-session state)
5. **No Cross-Tab Sync**: No storage event listeners needed (each user has their own isolated key)

**Flow:**
```
1. Moderator creates session template (topics/structure)
   ↓
2. User joins → creates ephemeral sub-session in localStorage
   Key: ideation-draft-{sessionId}-{userId}
   ↓
3. User contributes → drafts stored locally (isolated)
   ↓
4. User clicks "Submit" → POST to API → clear localStorage
   ↓
5. Voting phase → fetch all contributions from DB → reconstruct as cards
   ↓
6. Final report → aggregated view from database
```

**Why This Design:**
- ✅ Zero cross-contamination between users
- ✅ Simple state management (no sync complexity)
- ✅ Clean separation: frontend working state → backend persistent state
- ✅ Stateless voting (reconstructed from DB)

#### 5.4 Contribution Flow (Implementation Plan)

- **Structure Phase** (Moderator Only):
  - Moderator adds rows incrementally, filling `Domain` + `Topic`
  - Each new topic becomes a new row with unique ID
  - Rows can be locked individually; all rows must be locked before finalizing structure
  - "Finalize structure" button validates all topics are locked and publishes session
  
- **Contribution Phase** (Per User):
  - User joins session → creates ephemeral sub-session in user-specific localStorage
  - User edits the four AI columns independently (Current status, Minor impact, Disruption, Reimagination)
  - Drafts stored in isolated localStorage key: `ideation-draft-{sessionId}-{userId}`
  - "Submit" button packages all contributions and POSTs to API
  - **One-shot submission**: No periodic saves, no auto-save, just submit button
  - On successful submission:
    - Contributions saved to database with `participantId`, `email`, `author`, `submittedAt`
    - localStorage draft is cleared (ephemeral state discarded)
    - User marked as "submitted" in `session_participants` table
    - User sees read-only snapshot of their submitted contributions
  
- **Backend Storage**:
  - No "sub-session" table needed
  - `session_participants` table tracks submission status
  - `contributions` table stores actual submissions
  - `(session_id, participant_id)` pair represents implicit sub-session

#### 5.5 Voting Phase (Implementation Plan)

**Trigger**: Moderator enables voting after reviewing submission status (who has submitted)

**Backend Query**: Fetch all contributions from database
```sql
SELECT c.*, t.name as topic_name, p.display_name as author_name
FROM contributions c
JOIN topics t ON c.topic_id = t.topic_id
JOIN participants p ON c.participant_id = p.participant_id
WHERE c.session_id = ?
ORDER BY t.topic_id, c.submitted_at
```

**Frontend Display**:
- **Reconstructed from DB**: No dependency on localStorage or sub-session state
- **Entry Cards**: Each contribution displayed as a card showing:
  - Author name and vote count
  - All four text fields (Current status, Minor impact, Disruption, Reimagination)
  - "Vote" button to increment vote count
- **Voting Behavior**: 
  - Backend tracks votes with vote deduplication (one vote per participant per contribution)
  - Votes saved to `votes` table: `(contribution_id, voter_id, voted_at)`
  - Vote counts updated in real-time via API polling or WebSockets
- **Leaderboard**: Shows top 3 voted submissions across all topics
- **State**: Only enabled when `sessionState === "voting"`

**Key Point**: Voting view is completely stateless - built fresh from database each time

#### 5.6 Final Report (Implementation Plan)

**Trigger**: Moderator publishes final view after locking votes

**Backend Query**: Fetch contributions with vote counts
```sql
SELECT c.*, COUNT(v.vote_id) as vote_count
FROM contributions c
LEFT JOIN votes v ON c.contribution_id = v.contribution_id
WHERE c.session_id = ?
GROUP BY c.contribution_id
ORDER BY vote_count DESC
```

**Frontend Display**:
- Ranked cards sorted by vote count
- Read-only view (no editing, no voting)
- Original contributions with author attribution
- Download report button (same report for all users)
- Users cannot access their original sub-session (it's been discarded)

#### 5.7 Data consistency notes
- `Topic` is unique per session; server enforces uniqueness when new rows are created.
- Rows are tracked by `domain`, `topic`, and `row_index` to preserve ordering for the report.
- Text columns should support large text (use `TEXT` type) and optionally encode Markdown/HTML on the client.

#### 5.8 Next steps for table design
1. Define frontend state shape for rows (`[{ domain, topic, currentStatus, minorImpact, disruption, reimagination }]`).
2. Sketch UI for adding rows vs editing columns (possibly separate modes: “Structure mode” vs “Contribution mode”).
3. Plan API payloads so backend can upsert rows/cells without destroying others’ content.

### 6. UI Design – table-centric experience

#### 6.1 Entry mode vs contribution mode (Implemented)
- **Structure mode**: 
  - All users can add/edit `Domain` and `Topic` rows (not restricted to moderator in prototype).
  - Shows "Structure mode" header with instructions.
  - Domain input with autocomplete from existing domains; Topic input (required).
  - "Add topic" button creates new row.
  - Each row shows domain/topic inputs (disabled when locked) and "Lock topic" button.
  - When locked, row cannot be edited in Structure mode.
  - "Finalize structure" button validates all topics are locked and switches to Contribution mode.
- **Contribution mode**: 
  - Once structure is finalized, participants see the four AI columns with textareas.
  - Textareas are standard HTML textareas (no auto-expand; manual resize).
  - Each textarea has label and hint text describing the field.
  - Drafts stored in user-specific localStorage (isolated per user).
  - "Submit table" button submits all rows with one-shot POST to API.
  - Voting view reconstructed from database after moderator enables voting.

#### 6.2 Layout principles
- Table is responsive: desktops show 6 columns, tablets collapse `Current status` + AI columns into stacked cards per row.
- Use sticky headers (Domain, Topic) so they stay visible when scrolling long tables.
- Provide visual cues (badges) for row state: `Draft`, `Locked`, `Submitted`, `Reviewed`.
- Participants can filter rows by domain or search topics via client-side input.

#### 6.3 Voting & compiled view (Implemented)
- **Compiled View Toggle**: "Show compiled view" / "Hide compiled view" button in toolbar; auto-opens after submission.
- **Entry Display**: 
  - Shows every participant's text in grid layout (cards per entry).
  - Each entry card shows author name, vote count, and all four text fields.
  - "↑ Vote" button on each entry increments vote count.
- **Vote Display**: 
  - Vote counts shown next to author name in each entry.
  - Aggregated totals shown in row headers.
  - Leaderboard shows top 3 voted submissions with topic, author, domain, and vote count.
- **Voting Behavior**: 
  - Currently allows unlimited votes (no deduplication in prototype).
  - Votes increment immediately in UI.
  - **Note**: Backend will implement vote deduplication (one vote per participant per entry) and prevent self-voting.
- **Future Enhancement**: Highlight own contributions with subtle background shade (not yet implemented).

#### 6.4 Interaction details
- Save actions:
  - Autosave per text area (debounced) to reduce loss.
  - Manual “Submit table” button performs a final POST and returns compiled data.
- Row addition:
  - “Add row” button triggers inline form; allow pressing Enter to create next topic quickly.
  - Domain input could autofill previous value or show dropdown of existing domains in session.
- Error/feedback:
  - Inline validation per column (e.g., “Describe the current status before continuing”).
  - Toasts for successful saves, warnings if API unreachable, and prompts before losing unsaved text.

#### 6.5 Next UI steps
1. Build React component hierarchy: `AuthLayout`, `SessionToolbar`, `TopicTable`, `CompiledView`, `VotingPanel`.
2. Determine reusable form controls (text area with autosave, status badge, domain chooser).
3. Wire local state to API hooks/contexts to keep rows, votes, and session info synchronized.
4. Prepare storybook/mock for table to validate responsive behavior before hooking real data.

### 7. Implemented Design Decisions (UI Prototype)

#### 7.1 Session Management (Implemented)
- **Session Creation**: Moderator creates a session with a name; system generates unique session ID (format: `session-{timestamp}-{random}`).
- **Session Joining**: Participants join using session ID; they are automatically added to the participants list.
- **Session Metadata**: Each session stores:
  - `id`: Unique session identifier
  - `name`: Human-readable session name
  - `moderator`: Object with `participantId`, `email`, `displayName`
  - `createdAt`: ISO timestamp
  - `participants`: Array of participant objects with `participantId`, `email`, `displayName`, `joinedAt`
- **Session Persistence**: Sessions stored in localStorage with key `ideation-session-{sessionId}`; current session tracked in `ideation-current-session`.
- **Session UI**: 
  - Shows session management panel when user is logged in but no session active
  - Displays session info (name, ID, moderator, participants) when session is active
  - "Leave Session" button to exit current session

#### 7.2 Participant Identification (Implemented)
- **Participant ID**: Uses email address (lowercased) as stable `participantId` identifier.
- **User Object**: Contains `email`, `displayName`, and `participantId` (derived from email).
- **Entry Tracking**: Each submitted entry includes:
  - `participantId`: Stable identifier (email)
  - `email`: Email address
  - `author`: Display name for UI
  - `submittedAt`: ISO timestamp
  - `votes`: Vote count (starts at 0)

#### 7.3 Structure Mode Workflow (Implemented)
- **Initial State**: App starts in Structure mode with empty table.
- **Domain/Topic Input**: 
  - Domain input field with autocomplete from existing domains
  - Topic input field (required)
  - "Add topic" button creates new row
- **Row Locking**: 
  - Each row has "Lock topic" button (disabled when already locked)
  - Locked rows cannot be edited in Structure mode
  - All topics must be locked before finalizing structure
- **Finalize Structure**: 
  - "Finalize structure" button appears in Structure mode
  - Validates all topics are locked
  - Switches to Contribution mode and enables contribution features
  - Once finalized, structure cannot be modified

#### 7.4 Contribution Mode Workflow (Implementation Plan - Sub-Session Pattern)

**Access Control**: Contribution mode only enabled after structure is finalized.

**Sub-Session Initialization**:
- When user joins session, create ephemeral sub-session:
  - localStorage key: `ideation-draft-{sessionId}-{userId}`
  - Contains: session topics (from template) + empty draft object
  - Completely isolated per user (no cross-contamination)

**Row Display**: 
  - Shows domain and topic as read-only headers (from session template)
  - Status badge indicates "Locked for contributions"
  - Only locked rows show contribution textareas

**Text Input Fields**:
  - Four textareas: "Current status", "Minor impact by AI", "Disruption by AI", "Reimagination by AI"
  - Each has label and hint text
  - Values stored in React state + localStorage (isolated per user)
  - **No auto-save**: Drafts only saved locally for persistence across page refreshes

**Submit Flow**: 
  1. User clicks "Submit table" button
  2. Collect all draft contributions from local state
  3. **One-shot API call**: POST to `/api/sessions/{sessionId}/contributions`
  4. Backend saves to `contributions` table with `participantId`, `submittedAt`
  5. Backend updates `session_participants` table: status → "submitted"
  6. On success:
     - Clear localStorage draft (ephemeral state discarded)
     - Fetch submitted contributions from API
     - Display as read-only snapshot
     - Show confirmation: "✓ You have submitted your contributions. Thank you!"
  7. User cannot edit after submission

**No Cross-Tab Sync**: 
- Each user's localStorage is isolated (user-specific key)
- No storage event listeners needed
- No risk of seeing other users' drafts

#### 7.5 Compiled View (Implemented)
- **Toggle**: "Show compiled view" / "Hide compiled view" button in toolbar.
- **Display Format**: 
  - Shows all rows with domain/topic headers
  - Each row displays all participant entries in grid layout
  - Each entry shows: author name, vote count, and all four text fields
- **Voting**: 
  - "↑ Vote" button on each entry
  - Increments vote count immediately
  - Vote counts displayed next to author name
- **Leaderboard**: 
  - Shows top 3 voted submissions across all rows
  - Displays topic, author, domain, and vote count

#### 7.6 Voting System (Implemented)
- **Vote Tracking**: 
  - Only vote counts are tracked (not individual voter identities)
  - Each entry has a `votes` field (number)
  - Votes start at 0 when entry is submitted
- **Vote Action**: 
  - Clicking "Vote" button increments vote count by 1
  - No limit on number of votes per user (will be restricted in backend)
  - Votes update immediately in UI
- **Vote Display**: 
  - Shown in compiled view next to author name
  - Aggregated totals shown in row headers
  - Leaderboard sorted by vote count

#### 7.7 Report Generation (Implemented)
- **Report Structure** (Clean, Idea-Focused):
  ```json
  {
    "session": {
      "id": "session-id",
      "name": "Session Name",
      "createdAt": "ISO timestamp",
      "moderator": {
        "displayName": "Moderator Name",
        "email": "moderator@example.com"
      },
      "participants": [
        {
          "displayName": "User Name",
          "email": "user@example.com",
          "joinedAt": "ISO timestamp"
        }
      ]
    },
    "generatedAt": "ISO timestamp",
    "topics": [
      {
        "domain": "Domain Name",
        "topic": "Topic Name",
        "totalVotes": 15,
        "contributions": [
          {
            "author": "User Name",
            "authorEmail": "user@example.com",
            "currentStatus": "...",
            "minorImpact": "...",
            "disruption": "...",
            "reimagination": "...",
            "votes": 5,
            "submittedAt": "ISO timestamp"
          }
        ]
      }
    ]
  }
  ```
- **Design Focus**:
  - **Ideas First**: Topics and contributions are primary focus
  - **Author Attribution**: Track who wrote what (for context)
  - **Vote Counts Only**: No tracking of WHO voted (privacy)
  - **Auto-Sorted**: Topics sorted by total votes (desc), contributions sorted by votes within each topic
  - **No Redundancy**: Removed `draft`, `locked`, `voters[]`, `generatedBy`, `participantId` duplication
- **Download**: 
  - "Download report" button generates JSON file
  - Filename: `ideation-report-{session-name}-{timestamp}.json`
  - Includes full session metadata and all participant contributions
  - Report structure optimized for analysis and ranking by ideas/topics

#### 7.8 Multi-User Testing (Sub-Session Isolation)

**localStorage Keys**: User-specific (no cross-contamination)
- Moderator: `ideation-draft-{sessionId}-moderator@test.com`
- User1: `ideation-draft-{sessionId}-user1@test.com`
- User2: `ideation-draft-{sessionId}-user2@test.com`

**No Cross-Tab Syncing**: 
- Each user's draft is completely isolated
- No storage event listeners
- No risk of seeing other users' drafts or leftover characters

**Testing Workflow**:
  1. Open multiple browser tabs/windows (or different browsers)
  2. Sign in as different users in each tab
  3. Join same session using session ID
  4. Each user works in their isolated sub-session
  5. Submit contributions independently (one-shot POST to API)
  6. Moderator sees submission status (who submitted, who's pending)
  7. Moderator enables voting
  8. Voting view reconstructed from database (all contributions visible)

**Key Difference from Previous Design**:
- **Before**: Shared localStorage with sync → contamination issues
- **After**: Isolated localStorage per user → clean separation

#### 7.9 Data Persistence (Sub-Session Architecture)

**Frontend Storage (Ephemeral):**
- **Draft Key (per user)**: `ideation-draft-{sessionId}-{userId}`
- **Purpose**: Store user's work-in-progress contributions (not shared)
- **Lifecycle**: Created on session join → cleared on submission
- **Data Structure**:
  ```javascript
  {
    sessionId: "session-123",
    participantId: "user1@test.com",
    topics: [...],  // Copied from session template
    drafts: {
      topic1: { currentStatus: "...", minorImpact: "...", disruption: "...", reimagination: "..." },
      topic2: { ... }
    },
    lastUpdated: "ISO timestamp"
  }
  ```

**Session Metadata Storage:**
- **Key**: `ideation-current-session` (user context only)
- **Purpose**: Track which session user is currently in
- **Data**: Session ID, name, moderator info (metadata only, no contributions)

**Backend Storage (Persistent):**
- **sessions table**: Session metadata, topics, moderator
- **session_participants table**: Who joined, submission status, timestamps
- **contributions table**: Actual user submissions (persistent record)
- **votes table**: Vote tracking with deduplication

**No Cross-Tab Sync:**
- No storage event listeners
- No auto-save to backend (only on submit)
- No shared state between users

#### 7.10 UI Components (Implemented)
- **Auth Panel**: Sign up / Sign in tabs with email, password, display name fields
- **Session Management Panel**: Create/join session interface (shown when no active session)
- **Session Info Panel**: Displays session details, moderator info, participant list
- **Session Toolbar**: Mode switcher, compiled view toggle, clear session button
- **Structure Mode View**: Domain/topic inputs, row locking interface, finalize button
- **Contribution Mode View**: Textarea grid for AI columns, submit button
- **Compiled View**: Grid of all entries with voting, leaderboard section
- **Status Bar**: Message display for user feedback

#### 7.11 Staged Workflow (Implemented)

The session follows a clear staged workflow with moderator-controlled transitions:

**Stage 1: Setup (Moderator Only)**
- Moderator signs in and creates a new session
- Moderator enters session name, date/time, domains, and topics
- Moderator locks all topics and publishes the session
- Session becomes available for participants to join
- **Session State**: `setup` → `published` (ready for contributions)

**Stage 2: Contribution (All Participants)**
- Users sign in individually and select the available session
- Users land directly in Contribution mode (no other modes accessible)
- Users fill in their contributions for each topic (Current status, Minor impact, Disruption, Reimagination)
- Users submit their contributions when finished
- After submission, users see submitted values in read-only textareas with confirmation message: "✓ You have submitted your contributions. Thank you! Waiting for moderator to enable voting."
- Users cannot proceed until voting is enabled by moderator
- **Session State**: `published` or `contributing` → `voting` (when moderator enables voting)

**Stage 3: Voting (Moderator-Enabled)**
- Moderator reviews all submitted contributions (can see submission status panel)
- Moderator enables voting when ready: "Enable Voting" button (available when state is `published` or `contributing`)
- Once enabled, all participants can:
  - View all contributions from other participants in compiled view
  - Upvote contributions they like
  - See vote counts update in real-time
- Voting is only allowed when `sessionState === "voting"`
- Moderator can see voting progress
- **Session State**: `published` or `contributing` → `voting` → `voting_locked` (when moderator locks votes)

**Stage 4: Final View (Moderator-Controlled)**
- Moderator reviews voting results
- Moderator locks votes: "Lock Votes" button (no more voting allowed)
- Moderator publishes final view: "Publish Final View" button
- Once published, all participants see:
  - Final compiled view with all contributions
  - Vote counts (locked, no longer editable)
  - Download report button (same report for everyone)
- **Session State**: `voting_locked` → `final` (read-only, report available)

**Session State Management:**
- `setup`: Initial creation, moderator setting up structure (moderator-only)
- `published`: Session published, accepting contributions (default state after session creation)
- `contributing`: Active contribution phase (can be used interchangeably with `published` for contribution tracking)
- `voting`: Voting enabled, participants can vote (transitioned from `published`/`contributing` by moderator)
- `voting_locked`: Votes locked, no more voting allowed (transitioned from `voting` by moderator)
- `final`: Final view published, read-only, report available (transitioned from `voting_locked` by moderator)

**Moderator Controls:**
- **Enable Voting**: Transitions from `published` or `contributing` to `voting` state
- **Lock Votes**: Transitions from `voting` to `voting_locked` state
- **Publish Final View**: Transitions from `voting_locked` to `final` state
- **Submission Status View**: Available during `published` or `contributing` states to see who has submitted

**User Experience:**
- Users only see relevant UI for current stage
- Clear status messages indicating current stage and what's next
- No access to stages they shouldn't be in
- Smooth transitions between stages

#### 7.12 Moderator Submission Status View (Implementation Plan)

**Purpose:**
- Provides moderators with **status-only** view (not content)
- Helps decide when to enable voting based on submission completion
- Shows who has submitted and who is still working

**Display Conditions:**
- Visible only to moderators
- Shown during contribution phase (`sessionState` is `published` or `contributing`)
- Button in toolbar: "Submission Status"

**Information Displayed (Status Only, No Content):**
- **Total Participants**: Count from `session_participants` table
- **Submitted Count**: Count where `status = 'submitted'`
- **Pending Count**: Count where `status = 'joined'`
- **Participant List**:
  - Participant name/email
  - Status indicator: ✓ Submitted (green) / ⏳ Pending (yellow)
  - Timestamp of submission (if submitted)
  - **No contribution content shown** (just status)

**Backend Query:**
```sql
SELECT 
  participant_id,
  display_name,
  email,
  status,
  submitted_at
FROM session_participants
WHERE session_id = ?
ORDER BY submitted_at DESC NULLS LAST
```

**Frontend Display:**
- Modal or collapsible panel in toolbar
- Progress bar: "3/5 participants submitted (60%)"
- Color-coded status list
- Real-time updates via API polling (every 5-10 seconds during contribution phase)

**No Content Access**: Moderator only sees status, not what users have written

#### 7.13 API Endpoints (✅ Implemented & Tested)

**1. Submit Contributions (One-Shot)**
```
POST /api/sessions/{sessionId}/contributions
```
**Request Body:**
```json
{
  "participantId": "user1@test.com",
  "participantEmail": "user1@test.com",
  "participantName": "User One",
  "contributions": [
    {
      "topicId": "topic-1",
      "currentStatus": "Manual process today",
      "minorImpact": "AI-assisted data entry",
      "disruption": "Fully automated workflow",
      "reimagination": "AI predicts needs before they arise"
    }
  ]
}
```
**Backend Actions:**
1. Insert into `contributions` table (one row per topic)
2. Update `session_participants` table: `status = 'submitted'`, `submitted_at = NOW()`
3. Return success response

**Frontend Actions on Success:**
1. Clear localStorage draft key
2. Fetch submitted contributions from API
3. Display as read-only snapshot

**2. Get Submission Status (Moderator Only)**
```
GET /api/sessions/{sessionId}/status
```
**Response:**
```json
{
  "totalParticipants": 5,
  "submittedCount": 3,
  "pendingCount": 2,
  "participants": [
    {
      "participantId": "user1@test.com",
      "displayName": "User One",
      "status": "submitted",
      "submittedAt": "2024-01-15T10:30:00Z"
    },
    {
      "participantId": "user2@test.com",
      "displayName": "User Two",
      "status": "joined",
      "submittedAt": null
    }
  ]
}
```

**3. Get Contributions for Voting**
```
GET /api/sessions/{sessionId}/contributions
```
**Query Params:** `?state=voting` (only return if session in voting state)
**Response:**
```json
{
  "contributions": [
    {
      "contributionId": "contrib-1",
      "topicId": "topic-1",
      "topicName": "Fraud Detection",
      "participantId": "user1@test.com",
      "authorName": "User One",
      "currentStatus": "...",
      "minorImpact": "...",
      "disruption": "...",
      "reimagination": "...",
      "votes": 5,
      "submittedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**4. Submit Vote**
```
POST /api/sessions/{sessionId}/votes
```
**Request Body:**
```json
{
  "contributionId": "contrib-1",
  "voterId": "user2@test.com"
}
```
**Backend:** 
- Check for duplicate: `(contribution_id, voter_id)` unique constraint
- Insert into `votes` table
- Return updated vote count

**Implementation Status:**
- ✅ All 13 API endpoints fully implemented and tested (61 tests passing)
- ✅ Session state validation on backend
- ✅ Vote deduplication and self-vote prevention
- ✅ Comprehensive integration test suite with 100% pass rate
- 🔄 Frontend uses placeholder functions (localStorage-based); ready for API integration
- 📝 See `backend/README.md` for complete API documentation with request/response examples

#### 7.14 Database Schema (Backend Design)

**sessions table:**
```sql
CREATE TABLE sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  moderator_id VARCHAR(255) NOT NULL,
  session_state VARCHAR(50) DEFAULT 'setup',
  created_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  voting_enabled_at TIMESTAMP,
  finalized_at TIMESTAMP
);
```

**topics table:**
```sql
CREATE TABLE topics (
  topic_id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) REFERENCES sessions(session_id),
  domain VARCHAR(255) NOT NULL,
  topic_name VARCHAR(255) NOT NULL,
  sort_order INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**session_participants table:**
```sql
CREATE TABLE session_participants (
  session_id VARCHAR(255) REFERENCES sessions(session_id),
  participant_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'joined',  -- 'joined', 'submitted', 'voted'
  joined_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP,
  PRIMARY KEY (session_id, participant_id)
);
```

**contributions table:**
```sql
CREATE TABLE contributions (
  contribution_id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) REFERENCES sessions(session_id),
  topic_id VARCHAR(255) REFERENCES topics(topic_id),
  participant_id VARCHAR(255) NOT NULL,
  current_status TEXT,
  minor_impact TEXT,
  disruption TEXT,
  reimagination TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, topic_id, participant_id)  -- One contribution per user per topic
);
```

**votes table:**
```sql
CREATE TABLE votes (
  vote_id VARCHAR(255) PRIMARY KEY,
  contribution_id VARCHAR(255) REFERENCES contributions(contribution_id),
  voter_id VARCHAR(255) NOT NULL,
  voted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(contribution_id, voter_id)  -- Prevent duplicate votes
);
```

**Key Design Notes:**
- No "sub-session" table (it's an ephemeral frontend concept)
- `(session_id, participant_id)` pair represents implicit sub-session
- Unique constraints prevent duplicate contributions and votes
- `session_participants.status` tracks submission state

#### 7.15 Implementation Status & Next Steps

**✅ Phase 1: Frontend Refactoring (COMPLETE)**
1. ✅ Changed localStorage keys to user-specific: `ideation-draft-{sessionId}-{userId}`
2. ✅ Removed cross-tab sync (storage event listeners)
3. ✅ Implemented one-shot submission (clear draft after POST)
4. ✅ Added placeholder API functions for all endpoints
5. ✅ Updated UI to show read-only snapshot after submission
6. ✅ Implemented staged workflow with moderator controls
7. ✅ Added submission status tracking and live reporting

**✅ Phase 2: Backend API Development (COMPLETE)**
1. ✅ Set up SQLite database with sql.js (in-memory for development)
2. ✅ Implemented all 13 API endpoints:
   - ✅ Session CRUD operations (create, list, get, delete, join)
   - ✅ Topic and participant management
   - ✅ Contribution submission endpoint with one-shot POST
   - ✅ Submission status endpoint (moderator-only)
   - ✅ Voting endpoints with vote counts
   - ✅ State transition endpoints (moderator controls)
3. ✅ Added session state validation on all endpoints
4. ✅ Implemented vote deduplication logic (UNIQUE constraint)
5. ✅ Prevented self-voting
6. ✅ Comprehensive test suite: 61 integration tests (100% passing)

**🔄 Phase 3: Integration & Migration (IN PROGRESS)**
1. 🔄 Connect frontend placeholder functions to real API endpoints
2. 🔄 Migrate from localStorage to backend persistence
3. 🔄 Migrate from sql.js (in-memory) to PostgreSQL
4. 🔄 Implement JWT-based authentication
5. 🔄 Test end-to-end multi-user flow with real backend
6. 🔄 Generate final report (enhanced PDF/CSV export)

**📋 Phase 4: Production Features (PLANNED)**
1. Real-time updates (WebSockets or polling)
2. Azure AD authentication integration
3. Email notifications (session invites, voting enabled, final report)
4. Analytics dashboard for moderators
5. Session templates and reusability
6. Performance optimization and caching
7. Deployment to RHEL VM with Podman containers

