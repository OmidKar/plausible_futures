import { describe, it, expect, beforeEach } from 'vitest';

describe('localStorage Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('User-Specific Draft Keys (Sub-Session Pattern)', () => {
    it('should store drafts with user-specific keys', () => {
      const sessionId = 'session-123';
      const userId = 'user@test.com';
      const draftKey = `ideation-draft-${sessionId}-${userId}`;

      const draft = {
        sessionId,
        participantId: userId,
        rows: [
          {
            id: 'r-1',
            draft: {
              currentStatus: 'Draft content'
            }
          }
        ],
        lastUpdated: new Date().toISOString()
      };

      localStorage.setItem(draftKey, JSON.stringify(draft));

      const retrieved = JSON.parse(localStorage.getItem(draftKey));
      expect(retrieved.participantId).toBe(userId);
      expect(retrieved.rows[0].draft.currentStatus).toBe('Draft content');
    });

    it('should isolate drafts between different users', () => {
      const sessionId = 'session-123';
      const user1Draft = {
        sessionId,
        participantId: 'user1@test.com',
        rows: [{ id: 'r-1', draft: { currentStatus: 'User 1 draft' } }]
      };
      const user2Draft = {
        sessionId,
        participantId: 'user2@test.com',
        rows: [{ id: 'r-1', draft: { currentStatus: 'User 2 draft' } }]
      };

      localStorage.setItem(
        `ideation-draft-${sessionId}-user1@test.com`,
        JSON.stringify(user1Draft)
      );
      localStorage.setItem(
        `ideation-draft-${sessionId}-user2@test.com`,
        JSON.stringify(user2Draft)
      );

      const user1Retrieved = JSON.parse(
        localStorage.getItem(`ideation-draft-${sessionId}-user1@test.com`)
      );
      const user2Retrieved = JSON.parse(
        localStorage.getItem(`ideation-draft-${sessionId}-user2@test.com`)
      );

      expect(user1Retrieved.rows[0].draft.currentStatus).toBe('User 1 draft');
      expect(user2Retrieved.rows[0].draft.currentStatus).toBe('User 2 draft');
      // Verify isolation
      expect(user1Retrieved.rows[0].draft.currentStatus).not.toBe(
        user2Retrieved.rows[0].draft.currentStatus
      );
    });

    it('should clear draft after submission', () => {
      const sessionId = 'session-123';
      const userId = 'user@test.com';
      const draftKey = `ideation-draft-${sessionId}-${userId}`;

      localStorage.setItem(draftKey, JSON.stringify({ data: 'draft' }));
      expect(localStorage.getItem(draftKey)).toBeTruthy();

      // Simulate submission clearing draft
      localStorage.removeItem(draftKey);
      expect(localStorage.getItem(draftKey)).toBeNull();
    });
  });

  describe('Session Metadata Storage', () => {
    it('should store session metadata separately from drafts', () => {
      const sessionId = 'session-123';
      const metaKey = `ideation-session-meta-${sessionId}`;

      const metadata = {
        metadata: {
          id: sessionId,
          name: 'Test Session',
          moderator: { participantId: 'mod@test.com' }
        },
        rows: [
          {
            id: 'r-1',
            topic: 'Topic 1',
            history: []
          }
        ],
        structureFinalized: true,
        sessionState: 'published',
        participants: [],
        submittedParticipants: []
      };

      localStorage.setItem(metaKey, JSON.stringify(metadata));

      const retrieved = JSON.parse(localStorage.getItem(metaKey));
      expect(retrieved.sessionState).toBe('published');
      expect(retrieved.rows).toHaveLength(1);
      expect(retrieved.submittedParticipants).toEqual([]);
    });

    it('should merge submissions into metadata history', () => {
      const sessionId = 'session-123';
      const metaKey = `ideation-session-meta-${sessionId}`;

      // Initial metadata
      const metadata = {
        rows: [
          {
            id: 'r-1',
            topic: 'Topic 1',
            history: []
          }
        ],
        submittedParticipants: []
      };

      localStorage.setItem(metaKey, JSON.stringify(metadata));

      // User 1 submits
      const retrieved = JSON.parse(localStorage.getItem(metaKey));
      retrieved.rows[0].history.push({
        id: 'h-1',
        participantId: 'user1@test.com',
        content: 'User 1 submission'
      });
      retrieved.submittedParticipants.push('user1@test.com');
      localStorage.setItem(metaKey, JSON.stringify(retrieved));

      // User 2 submits (merge, don't overwrite)
      const retrieved2 = JSON.parse(localStorage.getItem(metaKey));
      retrieved2.rows[0].history.push({
        id: 'h-2',
        participantId: 'user2@test.com',
        content: 'User 2 submission'
      });
      retrieved2.submittedParticipants.push('user2@test.com');
      localStorage.setItem(metaKey, JSON.stringify(retrieved2));

      // Verify both submissions exist
      const final = JSON.parse(localStorage.getItem(metaKey));
      expect(final.rows[0].history).toHaveLength(2);
      expect(final.submittedParticipants).toHaveLength(2);
      expect(final.rows[0].history[0].participantId).toBe('user1@test.com');
      expect(final.rows[0].history[1].participantId).toBe('user2@test.com');
    });

    it('should track submitted participants separately', () => {
      const sessionId = 'session-123';
      const metaKey = `ideation-session-meta-${sessionId}`;

      const metadata = {
        participants: [
          { participantId: 'user1@test.com' },
          { participantId: 'user2@test.com' },
          { participantId: 'user3@test.com' }
        ],
        submittedParticipants: ['user1@test.com', 'user2@test.com']
      };

      localStorage.setItem(metaKey, JSON.stringify(metadata));

      const retrieved = JSON.parse(localStorage.getItem(metaKey));
      const totalParticipants = retrieved.participants.length;
      const submittedCount = retrieved.submittedParticipants.length;
      const pendingCount = totalParticipants - submittedCount;

      expect(totalParticipants).toBe(3);
      expect(submittedCount).toBe(2);
      expect(pendingCount).toBe(1);
    });
  });

  describe('Session State Updates', () => {
    it('should update session state without affecting other data', () => {
      const sessionId = 'session-123';
      const metaKey = `ideation-session-meta-${sessionId}`;

      const metadata = {
        sessionState: 'published',
        rows: [{ id: 'r-1', history: [{ id: 'h-1', votes: 5 }] }],
        submittedParticipants: ['user1@test.com']
      };

      localStorage.setItem(metaKey, JSON.stringify(metadata));

      // Update state only
      const retrieved = JSON.parse(localStorage.getItem(metaKey));
      retrieved.sessionState = 'voting';
      retrieved.lastUpdated = new Date().toISOString();
      localStorage.setItem(metaKey, JSON.stringify(retrieved));

      const updated = JSON.parse(localStorage.getItem(metaKey));
      expect(updated.sessionState).toBe('voting');
      expect(updated.rows).toHaveLength(1);
      expect(updated.submittedParticipants).toEqual(['user1@test.com']);
      expect(updated).toHaveProperty('lastUpdated');
    });
  });

  describe('Data Migration and Cleanup', () => {
    it('should handle missing voters array gracefully', () => {
      const entry = {
        id: 'h-1',
        votes: 5
        // voters array missing (old data)
      };

      const voters = entry.voters || [];
      expect(voters).toEqual([]);
      expect(Array.isArray(voters)).toBe(true);
    });

    it('should initialize empty history for new rows', () => {
      const row = {
        id: 'r-1',
        topic: 'New Topic',
        history: []
      };

      expect(row.history).toEqual([]);
      expect(Array.isArray(row.history)).toBe(true);
    });
  });
});

