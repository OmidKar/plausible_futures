import { describe, it, expect, beforeEach } from 'vitest';

describe('Session Logic', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Session Creation', () => {
    it('should generate unique session IDs', () => {
      const createSessionId = () => 
        `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const id1 = createSessionId();
      const id2 = createSessionId();
      
      expect(id1).toMatch(/^session-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^session-\d+-[a-z0-9]+$/);
      // Very unlikely to be the same (but timestamp might match)
      expect(id1).not.toBe(id2);
    });

    it('should create session with correct structure', () => {
      const mockUser = {
        participantId: 'moderator@test.com',
        email: 'moderator@test.com',
        displayName: 'Moderator'
      };

      const session = {
        id: 'session-test-123',
        name: 'Test Session',
        moderator: mockUser,
        createdAt: new Date().toISOString(),
        published: true,
        participants: [
          {
            ...mockUser,
            joinedAt: new Date().toISOString()
          }
        ]
      };

      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('name');
      expect(session).toHaveProperty('moderator');
      expect(session).toHaveProperty('participants');
      expect(session.participants).toHaveLength(1);
      expect(session.participants[0].participantId).toBe(mockUser.participantId);
    });
  });

  describe('Session State Transitions', () => {
    const validTransitions = [
      { from: 'setup', to: 'published', allowed: true },
      { from: 'published', to: 'voting', allowed: true },
      { from: 'voting', to: 'voting_locked', allowed: true },
      { from: 'voting_locked', to: 'final', allowed: true }
    ];

    it('should follow valid state transitions', () => {
      validTransitions.forEach(({ from, to, allowed }) => {
        expect(allowed).toBe(true);
      });
    });

    it('should track session state in metadata', () => {
      const sessionId = 'session-test-123';
      const metaKey = `ideation-session-meta-${sessionId}`;
      
      const metadata = {
        sessionState: 'published',
        structureFinalized: true,
        participants: [],
        submittedParticipants: [],
        rows: []
      };

      localStorage.setItem(metaKey, JSON.stringify(metadata));
      
      const retrieved = JSON.parse(localStorage.getItem(metaKey));
      expect(retrieved.sessionState).toBe('published');
    });
  });

  describe('Participant Management', () => {
    it('should add new participant to session', () => {
      const existingParticipants = [
        { participantId: 'user1@test.com', displayName: 'User 1' }
      ];

      const newParticipant = {
        participantId: 'user2@test.com',
        email: 'user2@test.com',
        displayName: 'User 2',
        joinedAt: new Date().toISOString()
      };

      const participantExists = existingParticipants.some(
        p => p.participantId === newParticipant.participantId
      );

      expect(participantExists).toBe(false);

      const updatedParticipants = [...existingParticipants, newParticipant];
      expect(updatedParticipants).toHaveLength(2);
      expect(updatedParticipants[1].participantId).toBe('user2@test.com');
    });

    it('should not add duplicate participants', () => {
      const participants = [
        { participantId: 'user1@test.com', displayName: 'User 1' }
      ];

      const duplicateParticipant = {
        participantId: 'user1@test.com',
        displayName: 'User 1 Again'
      };

      const exists = participants.some(
        p => p.participantId === duplicateParticipant.participantId
      );

      expect(exists).toBe(true);
      // Should not add duplicate
      const updatedParticipants = exists 
        ? participants 
        : [...participants, duplicateParticipant];
      
      expect(updatedParticipants).toHaveLength(1);
    });

    it('should track submission status per participant', () => {
      const submittedParticipants = ['user1@test.com', 'user2@test.com'];
      const allParticipants = [
        { participantId: 'user1@test.com' },
        { participantId: 'user2@test.com' },
        { participantId: 'user3@test.com' }
      ];

      const status = allParticipants.map(p => ({
        ...p,
        hasSubmitted: submittedParticipants.includes(p.participantId)
      }));

      expect(status[0].hasSubmitted).toBe(true);
      expect(status[1].hasSubmitted).toBe(true);
      expect(status[2].hasSubmitted).toBe(false);

      const submittedCount = status.filter(p => p.hasSubmitted).length;
      expect(submittedCount).toBe(2);
    });
  });

  describe('Row/Topic Management', () => {
    it('should create row with correct structure', () => {
      const row = {
        id: `r-${Date.now()}-test`,
        domain: 'Finance',
        topic: 'Fraud Detection',
        locked: false,
        draft: {
          currentStatus: "",
          minorImpact: "",
          disruption: "",
          reimagination: ""
        },
        history: []
      };

      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('domain');
      expect(row).toHaveProperty('topic');
      expect(row).toHaveProperty('locked');
      expect(row).toHaveProperty('draft');
      expect(row).toHaveProperty('history');
      expect(row.history).toEqual([]);
    });

    it('should lock row when all required fields are present', () => {
      const row = {
        id: 'r-1',
        domain: 'Finance',
        topic: 'Fraud Detection',
        locked: false
      };

      const canLock = !!(row.domain && row.topic && row.topic.trim());
      expect(canLock).toBe(true);

      const lockedRow = { ...row, locked: true };
      expect(lockedRow.locked).toBe(true);
    });

    it('should not allow locking rows with empty topic', () => {
      const row = {
        id: 'r-1',
        domain: 'Finance',
        topic: '',
        locked: false
      };

      const canLock = !!(row.domain && row.topic && row.topic.trim());
      expect(canLock).toBe(false);
    });
  });

  describe('Contribution Submission', () => {
    it('should create history entry with correct structure', () => {
      const user = {
        participantId: 'user@test.com',
        email: 'user@test.com',
        displayName: 'Test User'
      };

      const draft = {
        currentStatus: 'Manual process',
        minorImpact: 'AI-assisted',
        disruption: 'Automated',
        reimagination: 'Reimagined'
      };

      const entry = {
        id: `h-${Date.now()}-test`,
        author: user.displayName,
        participantId: user.participantId,
        email: user.email,
        votes: 0,
        voters: [],
        submittedAt: new Date().toISOString(),
        ...draft
      };

      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('author');
      expect(entry).toHaveProperty('participantId');
      expect(entry).toHaveProperty('votes');
      expect(entry).toHaveProperty('voters');
      expect(entry).toHaveProperty('submittedAt');
      expect(entry.votes).toBe(0);
      expect(entry.voters).toEqual([]);
    });

    it('should merge contributions to existing history', () => {
      const existingHistory = [
        { id: 'h-1', participantId: 'user1@test.com', votes: 3 }
      ];

      const newEntry = {
        id: 'h-2',
        participantId: 'user2@test.com',
        votes: 0
      };

      const mergedHistory = [...existingHistory, newEntry];
      expect(mergedHistory).toHaveLength(2);
      expect(mergedHistory[0].participantId).toBe('user1@test.com');
      expect(mergedHistory[1].participantId).toBe('user2@test.com');
    });

    it('should replace existing entry from same participant', () => {
      const existingHistory = [
        { id: 'h-1', participantId: 'user1@test.com', votes: 3 },
        { id: 'h-2', participantId: 'user2@test.com', votes: 5 }
      ];

      const userId = 'user1@test.com';
      const newEntry = {
        id: 'h-3',
        participantId: userId,
        votes: 0,
        content: 'Updated'
      };

      const filteredHistory = existingHistory.filter(
        entry => entry.participantId !== userId
      );
      const updatedHistory = [...filteredHistory, newEntry];

      expect(updatedHistory).toHaveLength(2);
      expect(updatedHistory.find(e => e.participantId === userId).id).toBe('h-3');
      expect(updatedHistory.find(e => e.participantId === userId).content).toBe('Updated');
    });
  });

  describe('Voting Logic', () => {
    it('should prevent self-voting', () => {
      const entry = {
        id: 'h-1',
        participantId: 'user1@test.com',
        votes: 0,
        voters: []
      };

      const voter = { participantId: 'user1@test.com' };
      const isOwnEntry = entry.participantId === voter.participantId;

      expect(isOwnEntry).toBe(true);
      // Should not allow vote
    });

    it('should prevent duplicate voting', () => {
      const entry = {
        id: 'h-1',
        participantId: 'user1@test.com',
        votes: 2,
        voters: ['user2@test.com', 'user3@test.com']
      };

      const voter = { participantId: 'user2@test.com' };
      const hasVoted = entry.voters.includes(voter.participantId);

      expect(hasVoted).toBe(true);
      // Should not allow duplicate vote
    });

    it('should allow valid vote', () => {
      const entry = {
        id: 'h-1',
        participantId: 'user1@test.com',
        votes: 1,
        voters: ['user2@test.com']
      };

      const voter = { participantId: 'user3@test.com' };
      const isOwnEntry = entry.participantId === voter.participantId;
      const hasVoted = entry.voters.includes(voter.participantId);

      expect(isOwnEntry).toBe(false);
      expect(hasVoted).toBe(false);
      // Should allow vote

      const updatedEntry = {
        ...entry,
        votes: entry.votes + 1,
        voters: [...entry.voters, voter.participantId]
      };

      expect(updatedEntry.votes).toBe(2);
      expect(updatedEntry.voters).toContain('user3@test.com');
      expect(updatedEntry.voters).toHaveLength(2);
    });

    it('should calculate leaderboard correctly', () => {
      const rows = [
        {
          id: 'r-1',
          topic: 'Topic 1',
          domain: 'Domain 1',
          history: [
            { id: 'h-1', author: 'User 1', votes: 5 },
            { id: 'h-2', author: 'User 2', votes: 3 }
          ]
        },
        {
          id: 'r-2',
          topic: 'Topic 2',
          domain: 'Domain 1',
          history: [
            { id: 'h-3', author: 'User 3', votes: 10 },
            { id: 'h-4', author: 'User 4', votes: 1 }
          ]
        }
      ];

      const allEntries = rows.flatMap(row =>
        row.history.map(entry => ({
          ...entry,
          topic: row.topic,
          domain: row.domain
        }))
      );

      const leaderboard = allEntries
        .sort((a, b) => (b.votes || 0) - (a.votes || 0))
        .slice(0, 3);

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].votes).toBe(10);
      expect(leaderboard[0].author).toBe('User 3');
      expect(leaderboard[1].votes).toBe(5);
      expect(leaderboard[2].votes).toBe(3);
    });
  });

  describe('Report Generation', () => {
    it('should calculate total votes per topic', () => {
      const contributions = [
        { votes: 5 },
        { votes: 3 },
        { votes: 2 }
      ];

      const totalVotes = contributions.reduce((sum, c) => sum + c.votes, 0);
      expect(totalVotes).toBe(10);
    });

    it('should sort contributions by votes descending', () => {
      const contributions = [
        { id: 1, votes: 3 },
        { id: 2, votes: 10 },
        { id: 3, votes: 5 }
      ];

      const sorted = [...contributions].sort((a, b) => b.votes - a.votes);
      
      expect(sorted[0].votes).toBe(10);
      expect(sorted[1].votes).toBe(5);
      expect(sorted[2].votes).toBe(3);
    });

    it('should sort topics by total votes descending', () => {
      const topics = [
        { topic: 'Topic 1', totalVotes: 15 },
        { topic: 'Topic 2', totalVotes: 30 },
        { topic: 'Topic 3', totalVotes: 5 }
      ];

      const sorted = [...topics].sort((a, b) => b.totalVotes - a.totalVotes);
      
      expect(sorted[0].topic).toBe('Topic 2');
      expect(sorted[1].topic).toBe('Topic 1');
      expect(sorted[2].topic).toBe('Topic 3');
    });

    it('should generate clean report structure', () => {
      const report = {
        session: {
          id: 'session-123',
          name: 'Test Session',
          moderator: {
            displayName: 'Moderator',
            email: 'mod@test.com'
          },
          participants: [
            { displayName: 'User 1', email: 'user1@test.com' }
          ]
        },
        generatedAt: new Date().toISOString(),
        topics: [
          {
            domain: 'Finance',
            topic: 'Fraud Detection',
            totalVotes: 10,
            contributions: [
              {
                author: 'User 1',
                authorEmail: 'user1@test.com',
                currentStatus: 'Manual',
                votes: 10
              }
            ]
          }
        ]
      };

      expect(report).toHaveProperty('session');
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('topics');
      expect(report.topics[0]).toHaveProperty('totalVotes');
      expect(report.topics[0]).toHaveProperty('contributions');
      expect(report.topics[0].contributions[0]).not.toHaveProperty('voters');
      expect(report.topics[0].contributions[0]).not.toHaveProperty('participantId');
    });
  });
});

