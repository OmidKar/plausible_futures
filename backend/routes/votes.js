import { Router } from 'express';
import db from '../db.js';

const router = Router();

/**
 * API #6: Submit Vote
 * POST /api/sessions/:sessionId/votes
 * 
 * Purpose: Record a user's vote on a contribution
 * Business Rules:
 * - One vote per user per contribution (enforced by UNIQUE constraint)
 * - Cannot vote on own contributions (checked)
 * - Only allowed when session is in "voting" state
 * - Returns updated vote count
 */
router.post('/sessions/:sessionId/votes', (req, res) => {
  const { sessionId } = req.params;
  const { contributionId, voterId } = req.body;

  // Validation
  if (!contributionId || !voterId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: contributionId, voterId'
    });
  }

  // Check session exists and is in voting state
  const session = db.prepare('SELECT session_id, session_state FROM sessions WHERE session_id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  if (session.session_state !== 'voting') {
    return res.status(400).json({
      success: false,
      error: `Voting is not enabled. Session is in "${session.session_state}" state.`
    });
  }

  // Check contribution exists and get participant_id
  const contribution = db.prepare(`
    SELECT contribution_id, participant_id, session_id 
    FROM contributions 
    WHERE contribution_id = ? AND session_id = ?
  `).get(contributionId, sessionId);

  if (!contribution) {
    return res.status(404).json({
      success: false,
      error: 'Contribution not found'
    });
  }

  // Prevent self-voting
  if (contribution.participant_id === voterId) {
    return res.status(403).json({
      success: false,
      error: 'Cannot vote on your own contribution'
    });
  }

  // Check if user already voted on this contribution
  const existingVote = db.prepare(`
    SELECT vote_id FROM votes 
    WHERE contribution_id = ? AND voter_id = ?
  `).get(contributionId, voterId);

  if (existingVote) {
    return res.status(409).json({
      success: false,
      error: 'You have already voted on this contribution'
    });
  }

  try {
    // Insert vote
    const voteId = `vote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    db.prepare(`
      INSERT INTO votes (vote_id, contribution_id, voter_id, voted_at)
      VALUES (?, ?, ?, ?)
    `).run(voteId, contributionId, voterId, new Date().toISOString());

    // Get updated vote count
    const voteCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM votes 
      WHERE contribution_id = ?
    `).get(contributionId);

    res.status(200).json({
      success: true,
      contributionId: contributionId,
      newVoteCount: voteCount.count,
      message: 'Vote recorded successfully'
    });

  } catch (error) {
    console.error('Error recording vote:', error);
    
    // Handle unique constraint violations (race condition)
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        success: false,
        error: 'You have already voted on this contribution'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to record vote',
      details: error.message
    });
  }
});

/**
 * Helper endpoint: Get vote count for a contribution
 * GET /api/sessions/:sessionId/contributions/:contributionId/votes
 */
router.get('/sessions/:sessionId/contributions/:contributionId/votes', (req, res) => {
  const { contributionId } = req.params;

  try {
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM votes 
      WHERE contribution_id = ?
    `).get(contributionId);

    res.status(200).json({
      success: true,
      contributionId: contributionId,
      voteCount: result.count
    });
  } catch (error) {
    console.error('Error fetching vote count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vote count'
    });
  }
});

export default router;

