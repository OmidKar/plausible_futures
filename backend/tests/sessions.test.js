import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import './setup.js';
import { cleanupTestData } from './setup.js';

// Simple HTTP client for testing
const request = async (method, path, body = null) => {
  const url = `http://localhost:3001${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, body: data };
};

describe('POST /api/sessions', () => {
  beforeEach(async () => {
  });

  it('should create a new session', async () => {
    const payload = {
      name: 'Test Session',
      moderatorId: 'mod@test.com',
      moderatorName: 'Test Moderator',
      moderatorEmail: 'mod@test.com'
    };

    const { status, body } = await request('POST', '/api/sessions', payload);

    assert.strictEqual(status, 201);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.sessionId);
    assert.strictEqual(body.data.name, 'Test Session');
    assert.strictEqual(body.data.moderatorId, 'mod@test.com');
    assert.strictEqual(body.data.state, 'setup');
    assert.ok(body.data.createdAt);
  });

  it('should reject creation without required fields', async () => {
    const { status, body } = await request('POST', '/api/sessions', {});

    assert.strictEqual(status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Missing required fields/);
  });

  it('should add moderator as participant', async () => {
    const payload = {
      name: 'Test Session',
      moderatorId: 'mod@test.com',
      moderatorName: 'Test Moderator',
      moderatorEmail: 'mod@test.com'
    };

    const { status, body } = await request('POST', '/api/sessions', payload);
    const sessionId = body.data.sessionId;

    // Get session details to verify moderator is a participant
    const { status: getStatus, body: getBody } = await request('GET', `/api/sessions/${sessionId}`);

    assert.strictEqual(getStatus, 200);
    assert.strictEqual(getBody.data.participants.length, 1);
    assert.strictEqual(getBody.data.participants[0].participant_id, 'mod@test.com');
  });
});

describe('POST /api/sessions/:sessionId/topics', () => {
  let sessionId;

  beforeEach(async () => {
    const { body } = await request('POST', '/api/sessions', {
      name: 'Test Session',
      moderatorId: 'mod@test.com'
    });
    sessionId = body.data.sessionId;
  });

  it('should add a topic to a session', async () => {
    const payload = {
      domain: 'Technology',
      topicName: 'AI Development',
      sortOrder: 1
    };

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/topics`, payload);

    assert.strictEqual(status, 201);
    assert.strictEqual(body.success, true);
    assert.ok(body.data.topicId);
    assert.strictEqual(body.data.domain, 'Technology');
    assert.strictEqual(body.data.topicName, 'AI Development');
    assert.strictEqual(body.data.sortOrder, 1);
  });

  it('should reject topic without required fields', async () => {
    const { status, body } = await request('POST', `/api/sessions/${sessionId}/topics`, {});

    assert.strictEqual(status, 400);
    assert.strictEqual(body.success, false);
  });

  it('should reject topic for non-existent session', async () => {
    const { status, body } = await request('POST', '/api/sessions/fake-id/topics', {
      domain: 'Tech',
      topicName: 'Test'
    });

    assert.strictEqual(status, 404);
    assert.strictEqual(body.success, false);
  });

  it('should default sortOrder to 0 if not provided', async () => {
    const { status, body } = await request('POST', `/api/sessions/${sessionId}/topics`, {
      domain: 'Science',
      topicName: 'Climate'
    });

    assert.strictEqual(status, 201);
    assert.strictEqual(body.data.sortOrder, 0);
  });
});

describe('POST /api/sessions/:sessionId/participants', () => {
  let sessionId;

  beforeEach(async () => {
    const { body } = await request('POST', '/api/sessions', {
      name: 'Test Session',
      moderatorId: 'mod@test.com'
    });
    sessionId = body.data.sessionId;
  });

  it('should add a participant to a session', async () => {
    const payload = {
      participantId: 'user1@test.com',
      displayName: 'User One',
      email: 'user1@test.com'
    };

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/participants`, payload);

    assert.strictEqual(status, 201);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.participantId, 'user1@test.com');
    assert.strictEqual(body.data.displayName, 'User One');
    assert.strictEqual(body.data.status, 'joined');
    assert.ok(body.data.joinedAt);
  });

  it('should reject participant without participantId', async () => {
    const { status, body } = await request('POST', `/api/sessions/${sessionId}/participants`, {});

    assert.strictEqual(status, 400);
    assert.strictEqual(body.success, false);
  });

  it('should reject duplicate participant', async () => {
    const payload = {
      participantId: 'user1@test.com',
      displayName: 'User One',
      email: 'user1@test.com'
    };

    await request('POST', `/api/sessions/${sessionId}/participants`, payload);
    const { status, body } = await request('POST', `/api/sessions/${sessionId}/participants`, payload);

    assert.strictEqual(status, 409);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /already in session/);
  });

  it('should use participantId as displayName if not provided', async () => {
    const { status, body } = await request('POST', `/api/sessions/${sessionId}/participants`, {
      participantId: 'user2@test.com'
    });

    assert.strictEqual(status, 201);
    assert.strictEqual(body.data.displayName, 'user2@test.com');
  });
});

describe('PATCH /api/sessions/:sessionId/state', () => {
  let sessionId;

  beforeEach(async () => {
    const { body } = await request('POST', '/api/sessions', {
      name: 'Test Session',
      moderatorId: 'mod@test.com'
    });
    sessionId = body.data.sessionId;
  });

  it('should update session state', async () => {
    const { status, body } = await request('PATCH', `/api/sessions/${sessionId}/state`, {
      state: 'published'
    });

    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.state, 'published');
  });

  it('should reject invalid state', async () => {
    const { status, body } = await request('PATCH', `/api/sessions/${sessionId}/state`, {
      state: 'invalid-state'
    });

    assert.strictEqual(status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Invalid state/);
  });

  it('should reject state update for non-existent session', async () => {
    const { status, body } = await request('PATCH', '/api/sessions/fake-id/state', {
      state: 'published'
    });

    assert.strictEqual(status, 404);
    assert.strictEqual(body.success, false);
  });

  it('should allow all valid state transitions', async () => {
    const validStates = ['setup', 'published', 'contributing', 'voting', 'voting_locked', 'final'];

    for (const state of validStates) {
      const { status, body } = await request('PATCH', `/api/sessions/${sessionId}/state`, { state });
      assert.strictEqual(status, 200);
      assert.strictEqual(body.data.state, state);
    }
  });
});

describe('GET /api/sessions/:sessionId', () => {
  let sessionId;

  beforeEach(async () => {
    const { body } = await request('POST', '/api/sessions', {
      name: 'Test Session',
      moderatorId: 'mod@test.com'
    });
    sessionId = body.data.sessionId;
  });

  it('should get session details', async () => {
    const { status, body } = await request('GET', `/api/sessions/${sessionId}`);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.sessionId, sessionId);
    assert.strictEqual(body.data.name, 'Test Session');
    assert.strictEqual(body.data.moderatorId, 'mod@test.com');
    assert.strictEqual(body.data.state, 'setup');
    assert.ok(Array.isArray(body.data.topics));
    assert.ok(Array.isArray(body.data.participants));
  });

  it('should return 404 for non-existent session', async () => {
    const { status, body } = await request('GET', '/api/sessions/fake-id');

    assert.strictEqual(status, 404);
    assert.strictEqual(body.success, false);
  });

  it('should include topics and participants', async () => {
    // Add a topic
    await request('POST', `/api/sessions/${sessionId}/topics`, {
      domain: 'Tech',
      topicName: 'AI'
    });

    // Add a participant
    await request('POST', `/api/sessions/${sessionId}/participants`, {
      participantId: 'user1@test.com',
      displayName: 'User One'
    });

    const { status, body } = await request('GET', `/api/sessions/${sessionId}`);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.data.topics.length, 1);
    assert.strictEqual(body.data.topics[0].topic_name, 'AI');
    assert.strictEqual(body.data.participants.length, 2); // moderator + user1
  });
});

describe('GET /api/sessions/:sessionId/status', () => {
  let sessionId;

  beforeEach(async () => {
    const { body } = await request('POST', '/api/sessions', {
      name: 'Test Session',
      moderatorId: 'mod@test.com'
    });
    sessionId = body.data.sessionId;
  });

  it('should get submission status for all participants', async () => {
    // Add participants
    await request('POST', `/api/sessions/${sessionId}/participants`, {
      participantId: 'user1@test.com',
      displayName: 'User One'
    });
    await request('POST', `/api/sessions/${sessionId}/participants`, {
      participantId: 'user2@test.com',
      displayName: 'User Two'
    });

    const { status, body } = await request('GET', `/api/sessions/${sessionId}/status`);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.sessionId, sessionId);
    assert.strictEqual(body.data.sessionName, 'Test Session');
    assert.strictEqual(body.data.summary.total, 3); // moderator + 2 users
    assert.strictEqual(body.data.summary.pending, 3); // none submitted yet
    assert.strictEqual(body.data.summary.submitted, 0);
    assert.ok(Array.isArray(body.data.participants));
  });

  it('should return 404 for non-existent session', async () => {
    const { status, body } = await request('GET', '/api/sessions/fake-id/status');

    assert.strictEqual(status, 404);
    assert.strictEqual(body.success, false);
  });

  it('should track participant status correctly', async () => {
    // Add participant
    await request('POST', `/api/sessions/${sessionId}/participants`, {
      participantId: 'user1@test.com',
      displayName: 'User One'
    });

    const { status, body } = await request('GET', `/api/sessions/${sessionId}/status`);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.data.participants.length, 2);
    
    const user = body.data.participants.find(p => p.participantId === 'user1@test.com');
    assert.ok(user);
    assert.strictEqual(user.status, 'joined');
    assert.ok(user.joinedAt);
    assert.strictEqual(user.submittedAt, null);
  });

  it('should include session state in response', async () => {
    await request('PATCH', `/api/sessions/${sessionId}/state`, { state: 'contributing' });

    const { status, body } = await request('GET', `/api/sessions/${sessionId}/status`);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.data.sessionState, 'contributing');
  });
});

describe('GET /api/sessions', () => {
  it('should list all sessions', async () => {
    // Create multiple sessions with unique names
    const { body: s1 } = await request('POST', '/api/sessions', {
      name: 'List Test Session 1',
      moderatorId: 'mod1@test.com'
    });
    const { body: s2 } = await request('POST', '/api/sessions', {
      name: 'List Test Session 2',
      moderatorId: 'mod2@test.com'
    });

    const { status, body } = await request('GET', '/api/sessions');

    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.sessions));
    // Check that our sessions are present (may be more from other tests)
    assert.ok(body.data.sessions.length >= 2);
    const ourSessions = body.data.sessions.filter(s => 
      s.sessionId === s1.data.sessionId || s.sessionId === s2.data.sessionId
    );
    assert.strictEqual(ourSessions.length, 2);
  });

  it('should return sessions array', async () => {
    const { status, body } = await request('GET', '/api/sessions');

    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body.data.sessions));
    // May be sessions from other tests, just check the structure
  });

  it('should filter by state', async () => {
    const { body: session1 } = await request('POST', '/api/sessions', {
      name: 'Filter State Test Session',
      moderatorId: 'mod-filter@test.com'
    });

    // Update to published
    await request('PATCH', `/api/sessions/${session1.data.sessionId}/state`, { state: 'published' });

    const { status, body } = await request('GET', '/api/sessions?state=published');

    assert.strictEqual(status, 200);
    // Check our session is in the results
    const ourSession = body.data.sessions.find(s => s.sessionId === session1.data.sessionId);
    assert.ok(ourSession);
    assert.strictEqual(ourSession.state, 'published');
  });

  it('should filter by moderatorId', async () => {
    const uniqueMod = `mod-unique-${Date.now()}@test.com`;
    const { body: session1 } = await request('POST', '/api/sessions', {
      name: 'Filter Moderator Test Session',
      moderatorId: uniqueMod
    });

    const { status, body } = await request('GET', `/api/sessions?moderatorId=${uniqueMod}`);

    assert.strictEqual(status, 200);
    // Check our session is present
    assert.ok(body.data.sessions.length >= 1);
    assert.ok(body.data.sessions.every(s => s.moderatorId === uniqueMod));
    const ourSession = body.data.sessions.find(s => s.sessionId === session1.data.sessionId);
    assert.ok(ourSession);
  });

  it('should order sessions by creation date (newest first)', async () => {
    const uniqueMod = `mod-order-${Date.now()}@test.com`;
    const { body: session1 } = await request('POST', '/api/sessions', {
      name: 'Order Test Session 1',
      moderatorId: uniqueMod
    });
    
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const { body: session2 } = await request('POST', '/api/sessions', {
      name: 'Order Test Session 2',
      moderatorId: uniqueMod
    });

    const { status, body } = await request('GET', `/api/sessions?moderatorId=${uniqueMod}`);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.data.sessions.length, 2);
    // Newest first
    assert.strictEqual(body.data.sessions[0].sessionId, session2.data.sessionId);
    assert.strictEqual(body.data.sessions[1].sessionId, session1.data.sessionId);
  });
});

describe('POST /api/sessions/:sessionId/join', () => {
  let sessionId;

  beforeEach(async () => {
    const { body } = await request('POST', '/api/sessions', {
      name: 'Test Session',
      moderatorId: 'mod@test.com'
    });
    sessionId = body.data.sessionId;
    
    // Publish session to make it joinable
    await request('PATCH', `/api/sessions/${sessionId}/state`, { state: 'published' });
  });

  it('should allow user to join a session', async () => {
    const payload = {
      participantId: 'user1@test.com',
      displayName: 'User One',
      email: 'user1@test.com'
    };

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/join`, payload);

    assert.strictEqual(status, 201);
    assert.strictEqual(body.success, true);
    assert.match(body.message, /Successfully joined/);
    assert.strictEqual(body.data.participantId, 'user1@test.com');
    assert.strictEqual(body.data.sessionName, 'Test Session');
    assert.strictEqual(body.data.status, 'joined');
    assert.ok(body.data.joinedAt);
  });

  it('should reject join without participantId', async () => {
    const { status, body } = await request('POST', `/api/sessions/${sessionId}/join`, {});

    assert.strictEqual(status, 400);
    assert.strictEqual(body.success, false);
  });

  it('should reject join for non-existent session', async () => {
    const { status, body } = await request('POST', '/api/sessions/fake-id/join', {
      participantId: 'user1@test.com'
    });

    assert.strictEqual(status, 404);
    assert.strictEqual(body.success, false);
  });

  it('should prevent joining finalized session', async () => {
    await request('PATCH', `/api/sessions/${sessionId}/state`, { state: 'final' });

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/join`, {
      participantId: 'user1@test.com'
    });

    assert.strictEqual(status, 403);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /finalized/);
  });

  it('should handle duplicate join gracefully', async () => {
    const payload = {
      participantId: 'user1@test.com',
      displayName: 'User One'
    };

    // Join first time
    await request('POST', `/api/sessions/${sessionId}/join`, payload);
    
    // Join again
    const { status, body } = await request('POST', `/api/sessions/${sessionId}/join`, payload);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.match(body.message, /Already joined/);
  });

  it('should use participantId as defaults if name/email not provided', async () => {
    const { status, body } = await request('POST', `/api/sessions/${sessionId}/join`, {
      participantId: 'user2@test.com'
    });

    assert.strictEqual(status, 201);
    assert.strictEqual(body.data.displayName, 'user2@test.com');
    assert.strictEqual(body.data.email, 'user2@test.com');
  });

  it('should include session info in response', async () => {
    const { status, body } = await request('POST', `/api/sessions/${sessionId}/join`, {
      participantId: 'user1@test.com'
    });

    assert.strictEqual(status, 201);
    assert.strictEqual(body.data.sessionName, 'Test Session');
    assert.strictEqual(body.data.sessionState, 'published');
  });
});

describe('DELETE /api/sessions/:sessionId', () => {
  let sessionId;

  beforeEach(async () => {
    const { body } = await request('POST', '/api/sessions', {
      name: 'Test Session',
      moderatorId: 'mod@test.com'
    });
    sessionId = body.data.sessionId;
  });

  it('should delete a session', async () => {
    const { status, body } = await request('DELETE', `/api/sessions/${sessionId}`);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);

    // Verify session is deleted
    const { status: getStatus } = await request('GET', `/api/sessions/${sessionId}`);
    assert.strictEqual(getStatus, 404);
  });

  it('should return 404 for non-existent session', async () => {
    const { status, body } = await request('DELETE', '/api/sessions/fake-id');

    assert.strictEqual(status, 404);
    assert.strictEqual(body.success, false);
  });

  it('should delete all related data', async () => {
    // Add topic, participant, contribution
    const { body: topicBody } = await request('POST', `/api/sessions/${sessionId}/topics`, {
      domain: 'Tech',
      topicName: 'AI'
    });
    const topicId = topicBody.data.topicId;

    await request('POST', `/api/sessions/${sessionId}/participants`, {
      participantId: 'user1@test.com'
    });

    // Set to published so we can submit
    await request('PATCH', `/api/sessions/${sessionId}/state`, { state: 'published' });

    await request('POST', `/api/sessions/${sessionId}/contributions`, {
      participantId: 'user1@test.com',
      submissions: [{
        rowId: topicId,
        currentStatus: 'Test',
        minorImpact: '',
        disruption: '',
        reimagination: ''
      }]
    });

    // Now delete session
    const { status } = await request('DELETE', `/api/sessions/${sessionId}`);
    assert.strictEqual(status, 200);

    // Verify session and related data are gone
    const db = (await import('../db.js')).default;
    const contributions = db.prepare('SELECT * FROM contributions WHERE session_id = ?').all(sessionId);
    const participants = db.prepare('SELECT * FROM session_participants WHERE session_id = ?').all(sessionId);
    const topics = db.prepare('SELECT * FROM topics WHERE session_id = ?').all(sessionId);

    assert.strictEqual(contributions.length, 0);
    assert.strictEqual(participants.length, 0);
    assert.strictEqual(topics.length, 0);
  });
});

