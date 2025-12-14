import { after } from 'node:test';
import db from '../db.js';

// Test data helpers - now using API calls
const API_BASE = 'http://localhost:3001/api';

export const createTestSession = async () => {
  const response = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Session',
      moderatorId: 'moderator@test.com',
      moderatorName: 'Test Moderator',
      moderatorEmail: 'moderator@test.com'
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create test session: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  // Set to published state for tests
  const stateResponse = await fetch(`${API_BASE}/sessions/${data.data.sessionId}/state`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'published' })
  });
  
  if (!stateResponse.ok) {
    const errorText = await stateResponse.text();
    throw new Error(`Failed to set session state: ${stateResponse.status} - ${errorText}`);
  }
  
  return data.data.sessionId;
};

export const createTestTopic = async (sessionId, topicId = null) => {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/topics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domain: 'Test Domain',
      topicName: 'Test Topic',
      sortOrder: 1
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create test topic: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data.topicId;
};

export const createTestParticipant = async (sessionId, participantId = 'user@test.com') => {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/participants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participantId,
      displayName: 'Test User',
      email: participantId
    })
  });
  
  if (!response.ok && response.status !== 409) { // 409 = already exists, which is fine
    throw new Error(`Failed to create test participant: ${response.status}`);
  }
  
  return participantId;
};

export const createTestContribution = async (sessionId, topicId, participantId) => {
  // Use the API to create the contribution
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/contributions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participantId,
      participantEmail: participantId,
      participantName: 'Test User',
      submissions: [
        {
          rowId: topicId,
          domain: 'Test Domain',
          topic: 'Test Topic',
          currentStatus: 'Test status',
          minorImpact: 'Test minor',
          disruption: 'Test disruption',
          reimagination: 'Test reimagination',
          submittedAt: new Date().toISOString()
        }
      ]
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create test contribution: ${response.status} - ${errorText}`);
  }
  
  // Fetch contributions to get the ID of the one we just created
  const getResponse = await fetch(`${API_BASE}/sessions/${sessionId}/contributions`);
  if (!getResponse.ok) {
    throw new Error(`Failed to fetch contributions: ${getResponse.status}`);
  }
  
  const data = await getResponse.json();
  
  // Find the contribution for this topic and participant
  for (const topic of data.contributions) {
    if (topic.id === topicId) {
      const contribution = topic.history.find(h => h.participantId === participantId);
      if (contribution) {
        return contribution.id; // contribution.id is the contribution_id
      }
    }
  }
  
  throw new Error('Could not find created contribution');
};

export const cleanupTestData = async () => {
  try {
    // Get all sessions and delete them via API
    const response = await fetch(`${API_BASE}/sessions`);
    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data.sessions) {
        // Delete each session via API (cascades to all related data)
        await Promise.all(
          data.data.sessions.map(session =>
            fetch(`${API_BASE}/sessions/${session.sessionId}`, { method: 'DELETE' })
          )
        );
      }
    }
  } catch (e) {
    console.log('Cleanup warning:', e.message);
  }
};

// Clean up after all tests
after(async () => {
  await cleanupTestData();
});

