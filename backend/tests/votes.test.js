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

// Simple HTTP client
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

describe('POST /api/sessions/:sessionId/votes', () => {
  let sessionId, topicId, contributionId;

  beforeEach(async () => {
    sessionId = await createTestSession();
    topicId = await createTestTopic(sessionId);
    await createTestParticipant(sessionId, 'user1@test.com');
    await createTestParticipant(sessionId, 'user2@test.com');
    contributionId = await createTestContribution(sessionId, topicId, 'user1@test.com');

    // Set session to voting state via API
    await request('PATCH', `/api/sessions/${sessionId}/state`, { state: 'voting' });
  });

  it('should accept valid vote', async () => {
    const payload = {
      contributionId: contributionId,
      voterId: 'user2@test.com'
    };

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/votes`, payload);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.newVoteCount, 1);
    assert.strictEqual(body.contributionId, contributionId);
  });

  it('should reject vote with missing fields', async () => {
    const payload = { contributionId: contributionId };

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/votes`, payload);

    assert.strictEqual(status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Missing required fields/);
  });

  it('should reject vote for non-existent session', async () => {
    const payload = {
      contributionId: contributionId,
      voterId: 'user2@test.com'
    };

    const { status, body } = await request('POST', '/api/sessions/fake-session/votes', payload);

    assert.strictEqual(status, 404);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Session not found/);
  });

  it('should reject vote when session is not in voting state', async () => {
    // Change session state to published via API
    await request('PATCH', `/api/sessions/${sessionId}/state`, { state: 'published' });

    const payload = {
      contributionId: contributionId,
      voterId: 'user2@test.com'
    };

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/votes`, payload);

    assert.strictEqual(status, 400);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Voting is not enabled/);
  });

  it('should reject vote for non-existent contribution', async () => {
    const payload = {
      contributionId: 'fake-contribution',
      voterId: 'user2@test.com'
    };

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/votes`, payload);

    assert.strictEqual(status, 404);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Contribution not found/);
  });

  it('should prevent self-voting', async () => {
    const payload = {
      contributionId: contributionId,
      voterId: 'user1@test.com' // Same as contribution author
    };

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/votes`, payload);

    assert.strictEqual(status, 403);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Cannot vote on your own contribution/);
  });

  it('should prevent duplicate voting', async () => {
    const payload = {
      contributionId: contributionId,
      voterId: 'user2@test.com'
    };

    // First vote
    await request('POST', `/api/sessions/${sessionId}/votes`, payload);

    // Second vote (duplicate)
    const { status, body } = await request('POST', `/api/sessions/${sessionId}/votes`, payload);

    assert.strictEqual(status, 409);
    assert.strictEqual(body.success, false);
    assert.match(body.error, /already voted/);
  });

  it('should increment vote count correctly', async () => {
    // Vote 1
    await request('POST', `/api/sessions/${sessionId}/votes`, {
      contributionId: contributionId,
      voterId: 'user2@test.com'
    });

    // Vote 2
    const { status, body } = await request('POST', `/api/sessions/${sessionId}/votes`, {
      contributionId: contributionId,
      voterId: 'user3@test.com'
    });

    assert.strictEqual(status, 200);
    assert.strictEqual(body.newVoteCount, 2);
  });

  it('should record vote in database', async () => {
    const payload = {
      contributionId: contributionId,
      voterId: 'user2@test.com'
    };

    const { status, body } = await request('POST', `/api/sessions/${sessionId}/votes`, payload);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.newVoteCount, 1);

    // Verify vote via API
    const { body: voteData } = await request('GET', `/api/sessions/${sessionId}/contributions/${contributionId}/votes`);
    
    assert.strictEqual(voteData.voteCount, 1);
    assert.strictEqual(voteData.contributionId, contributionId);
  });
});

describe('GET /api/sessions/:sessionId/contributions/:contributionId/votes', () => {
  let sessionId, topicId, contributionId;

  beforeEach(async () => {
    sessionId = await createTestSession();
    topicId = await createTestTopic(sessionId);
    contributionId = await createTestContribution(sessionId, topicId, 'user1@test.com');
  });

  it('should return vote count for contribution', async () => {
    // Set session to voting state
    await request('PATCH', `/api/sessions/${sessionId}/state`, { state: 'voting' });
    
    // Add participants who will vote
    await createTestParticipant(sessionId, 'user2@test.com');
    await createTestParticipant(sessionId, 'user3@test.com');
    
    // Add some votes via API
    await request('POST', `/api/sessions/${sessionId}/votes`, {
      voterId: 'user2@test.com',
      contributionId: contributionId
    });
    await request('POST', `/api/sessions/${sessionId}/votes`, {
      voterId: 'user3@test.com',
      contributionId: contributionId
    });

    const { status, body } = await request('GET', `/api/sessions/${sessionId}/contributions/${contributionId}/votes`);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.voteCount, 2);
    assert.strictEqual(body.contributionId, contributionId);
  });

  it('should return 0 votes for contribution with no votes', async () => {
    const { status, body } = await request('GET', `/api/sessions/${sessionId}/contributions/${contributionId}/votes`);

    assert.strictEqual(status, 200);
    assert.strictEqual(body.voteCount, 0);
  });
});

