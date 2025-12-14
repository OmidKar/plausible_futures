import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import './setup.js'; // Import to trigger before/after hooks
import {
  createTestSession,
  createTestTopic,
  createTestParticipant,
  createTestContribution,
  cleanupTestData
} from './setup.js';

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

describe('POST /api/sessions/:sessionId/contributions', () => {
  let sessionId, topicId;

  beforeEach(async () => {
    sessionId = await createTestSession();
    topicId = await createTestTopic(sessionId);
    await createTestParticipant(sessionId, 'user@test.com');
  });

  it('should accept valid contribution submission', async () => {
    const payload = {
      participantId: 'user@test.com',
      participantEmail: 'user@test.com',
      participantName: 'Test User',
      submissions: [
        {
          rowId: topicId,
          domain: 'Finance',
          topic: 'Fraud Detection',
          currentStatus: 'Manual process',
          minorImpact: 'AI-assisted',
          disruption: 'Automated',
          reimagination: 'Reimagined',
          submittedAt: new Date().toISOString()
        }
      ]
    };

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/contributions`, payload);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.contributionsCount, 1);
  });

  it('should reject submission with missing participantId', async () => {
    const payload = {
      submissions: [{ rowId: topicId, currentStatus: 'Test' }]
    };

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/contributions`, payload);

    assert.strictEqual(status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Missing required fields/);
  });

  it('should reject submission with empty submissions array', async () => {
    const payload = {
      participantId: 'user@test.com',
      submissions: []
    };

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/contributions`, payload);

    assert.strictEqual(status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /No submissions provided/);
  });

  it('should reject submission for non-existent session', async () => {
    const payload = {
      participantId: 'user@test.com',
      submissions: [{ rowId: topicId, currentStatus: 'Test' }]
    };

    const { status, body } = await request('POST', '/api/sessions/fake-session/contributions', payload);

    assert.strictEqual(status, 404);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Session not found/);
  });

  it('should update participant status to "submitted"', async () => {
    const payload = {
      participantId: 'user@test.com',
      submissions: [
        { rowId: topicId, currentStatus: 'Test', minorImpact: '', disruption: '', reimagination: '' }
      ]
    };

    await request('POST', `/api/sessions/${sessionId}/contributions`, payload);

    // Verify participant status updated via API
    const { status, body } = await request('GET', `/api/sessions/${sessionId}/status`);
    
    assert.strictEqual(status, 200);
    const participant = body.data.participants.find(p => p.participantId === 'user@test.com');
    assert.ok(participant);
    assert.strictEqual(participant.status, 'submitted');
    assert.ok(participant.submittedAt);
  });

  it('should handle multiple submissions in one request', async () => {
    const topic2 = await createTestTopic(sessionId, `topic-2-${Date.now()}`);
    const topic3 = await createTestTopic(sessionId, `topic-3-${Date.now()}`);

    const payload = {
      participantId: 'user@test.com',
      submissions: [
        { rowId: topicId, currentStatus: 'Status 1', minorImpact: '', disruption: '', reimagination: '' },
        { rowId: topic2, currentStatus: 'Status 2', minorImpact: '', disruption: '', reimagination: '' },
        { rowId: topic3, currentStatus: 'Status 3', minorImpact: '', disruption: '', reimagination: '' }
      ]
    };

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/contributions`, payload);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.contributionsCount, 3);
  });

  it('should allow resubmission (update existing contributions)', async () => {
    const payload = {
      participantId: 'user@test.com',
      submissions: [
        { rowId: topicId, currentStatus: 'First submission', minorImpact: '', disruption: '', reimagination: '' }
      ]
    };

    // First submission
    await request('POST', `/api/sessions/${sessionId}/contributions`, payload);

    // Second submission (update)
    payload.submissions[0].currentStatus = 'Updated submission';
    const { status, body } = await request('POST', `/api/sessions/${sessionId}/contributions`, payload);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);

    // Verify only one contribution exists (replaced, not duplicated) via API
    const { body: contribsBody } = await request('GET', `/api/sessions/${sessionId}/contributions`);
    const topic = contribsBody.contributions.find(t => t.id === topicId);
    assert.ok(topic);
    const userContributions = topic.history.filter(h => h.participantId === 'user@test.com');
    assert.strictEqual(userContributions.length, 1);
    assert.strictEqual(userContributions[0].currentStatus, 'Updated submission');
  });
});

describe('GET /api/sessions/:sessionId/contributions', () => {
  let sessionId, topicId;

  beforeEach(async () => {
    sessionId = await createTestSession();
    topicId = await createTestTopic(sessionId);
    await createTestParticipant(sessionId, 'user1@test.com');
    await createTestParticipant(sessionId, 'user2@test.com');
  });

  it('should return all contributions for a session', async () => {
    // Create contributions via API
    await createTestContribution(sessionId, topicId, 'user1@test.com');
    await createTestContribution(sessionId, topicId, 'user2@test.com');

    const { status, body } = await request('GET', `/api/sessions/${sessionId}/contributions`);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.contributions));
    assert.strictEqual(body.contributions.length, 1); // 1 topic
    assert.strictEqual(body.contributions[0].history.length, 2); // 2 contributions
  });

  it('should return 404 for non-existent session', async () => {
    const { status, body } = await request('GET', '/api/sessions/fake-session/contributions');

    assert.strictEqual(status, 404);
    assert.strictEqual(body.success, false);
  });

  it('should validate session state when state=voting param provided', async () => {
    // Session is in "published" state, not "voting"
    const { status, body } = await request('GET', `/api/sessions/${sessionId}/contributions?state=voting`);

    assert.strictEqual(status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /not in voting state/);
  });

  it('should return contributions when session is in voting state', async () => {
    // Create contribution FIRST (while in published state)
    await createTestContribution(sessionId, topicId, 'user1@test.com');

    // THEN update session to voting state via API
    await request('PATCH', `/api/sessions/${sessionId}/state`, { state: 'voting' });

    const { status, body } = await request('GET', `/api/sessions/${sessionId}/contributions?state=voting`);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.sessionState, 'voting');
  });

  it('should include vote counts in response', async () => {
    // Create contribution FIRST (while in published state)
    const contributionId = await createTestContribution(sessionId, topicId, 'user1@test.com');
    
    // Add participants who will vote
    await createTestParticipant(sessionId, 'user2@test.com');
    await createTestParticipant(sessionId, 'user3@test.com');

    // THEN set session to voting state
    await request('PATCH', `/api/sessions/${sessionId}/state`, { state: 'voting' });

    // Add votes via API
    await request('POST', `/api/sessions/${sessionId}/votes`, {
      voterId: 'user2@test.com',
      contributionId: contributionId
    });
    await request('POST', `/api/sessions/${sessionId}/votes`, {
      voterId: 'user3@test.com',
      contributionId: contributionId
    });

    const { status, body } = await request('GET', `/api/sessions/${sessionId}/contributions`);

    assert.strictEqual(status, 200);
    const contribution = body.contributions[0].history[0];
    assert.strictEqual(contribution.votes, 2);
  });

  it('should return contributions grouped by topic', async () => {
    const topic2 = await createTestTopic(sessionId, `topic-2-${Date.now()}`);

    // Create contributions for different topics via API
    await createTestContribution(sessionId, topicId, 'user1@test.com');
    await createTestContribution(sessionId, topic2, 'user1@test.com');

    const { status, body } = await request('GET', `/api/sessions/${sessionId}/contributions`);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.contributions.length, 2); // 2 topics
    assert.ok(body.contributions[0].topic);
    assert.ok(body.contributions[0].domain);
    assert.ok(Array.isArray(body.contributions[0].history));
  });
});

