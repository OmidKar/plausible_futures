import { describe, it, expect } from 'vitest';

// Helper functions extracted from App.jsx for testing
const defaultDraft = () => ({
  currentStatus: "",
  minorImpact: "",
  disruption: "",
  reimagination: ""
});

const getDraftKey = (sessionId, userId) => {
  if (!sessionId || !userId) return null;
  return `ideation-draft-${sessionId}-${userId}`;
};

const getSessionMetaKey = (sessionId) => {
  if (!sessionId) return null;
  return `ideation-session-meta-${sessionId}`;
};

describe('Helper Functions', () => {
  describe('defaultDraft', () => {
    it('should return an object with four empty string fields', () => {
      const draft = defaultDraft();
      expect(draft).toEqual({
        currentStatus: "",
        minorImpact: "",
        disruption: "",
        reimagination: ""
      });
    });

    it('should return a new object each time (not a reference)', () => {
      const draft1 = defaultDraft();
      const draft2 = defaultDraft();
      expect(draft1).not.toBe(draft2);
      expect(draft1).toEqual(draft2);
    });
  });

  describe('getDraftKey', () => {
    it('should return correct localStorage key format', () => {
      const key = getDraftKey('session-123', 'user@test.com');
      expect(key).toBe('ideation-draft-session-123-user@test.com');
    });

    it('should return null if sessionId is missing', () => {
      const key = getDraftKey(null, 'user@test.com');
      expect(key).toBeNull();
    });

    it('should return null if userId is missing', () => {
      const key = getDraftKey('session-123', null);
      expect(key).toBeNull();
    });

    it('should return null if both parameters are missing', () => {
      const key = getDraftKey(null, null);
      expect(key).toBeNull();
    });

    it('should handle empty strings as falsy', () => {
      const key1 = getDraftKey('', 'user@test.com');
      const key2 = getDraftKey('session-123', '');
      expect(key1).toBeNull();
      expect(key2).toBeNull();
    });
  });

  describe('getSessionMetaKey', () => {
    it('should return correct localStorage key format', () => {
      const key = getSessionMetaKey('session-456');
      expect(key).toBe('ideation-session-meta-session-456');
    });

    it('should return null if sessionId is missing', () => {
      const key = getSessionMetaKey(null);
      expect(key).toBeNull();
    });

    it('should return null for empty string', () => {
      const key = getSessionMetaKey('');
      expect(key).toBeNull();
    });

    it('should handle various session ID formats', () => {
      const formats = [
        'session-123',
        'session-1234567890-abc123',
        'custom-session-id',
        'SESSION-CAPS'
      ];

      formats.forEach(sessionId => {
        const key = getSessionMetaKey(sessionId);
        expect(key).toBe(`ideation-session-meta-${sessionId}`);
      });
    });
  });
});

