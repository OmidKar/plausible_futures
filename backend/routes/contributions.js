import { Router } from 'express';
import db from '../db-postgres.js';

const router = Router();

/**
 * API #3: Submit Contributions (One-Shot)
 * POST /api/sessions/:sessionId/contributions
 * 
 * Purpose: User submits all their contributions at once
 * Business Rules:
 * - One contribution per user per topic (enforced by UNIQUE constraint)
 * - Updates session_participants status to "submitted"
 * - Returns count of contributions saved
 */
router.post('/sessions/:sessionId/contributions', async (req, res) => {
  const { sessionId } = req.params;
  const { participantId, participantEmail, participantName, submissions } = req.body;

  // Validation
  if (!participantId || !submissions || !Array.isArray(submissions)) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: participantId, submissions'
    });
  }

  if (submissions.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No submissions provided'
    });
  }

  // Check session exists
  const session = await db.prepare('SELECT session_id, session_state FROM sessions WHERE session_id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  // Validate session is in correct state for submissions
  if (session.session_state !== 'published' && session.session_state !== 'contributing') {
    return res.status(400).json({
      success: false,
      error: `Cannot submit contributions. Session is in "${session.session_state}" state. Must be "published" or "contributing".`
    });
  }

  try {
    let savedCount = 0;

    // Insert or replace contributions (PostgreSQL syntax)
    const insertContribution = db.prepare(`
      INSERT INTO contributions (
        contribution_id, session_id, topic_id, participant_id,
        current_status, minor_impact, disruption, reimagination, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (session_id, topic_id, participant_id) 
      DO UPDATE SET
        contribution_id = EXCLUDED.contribution_id,
        current_status = EXCLUDED.current_status,
        minor_impact = EXCLUDED.minor_impact,
        disruption = EXCLUDED.disruption,
        reimagination = EXCLUDED.reimagination,
        submitted_at = EXCLUDED.submitted_at
    `);

    for (const submission of submissions) {
      const contributionId = `contrib-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await insertContribution.run(
        contributionId,
        sessionId,
        submission.rowId, // rowId is topicId in frontend
        participantId,
        submission.currentStatus || '',
        submission.minorImpact || '',
        submission.disruption || '',
        submission.reimagination || '',
        submission.submittedAt || new Date().toISOString()
      );
      
      savedCount++;
    }

    // Update participant status to "submitted"
    const updateParticipant = db.prepare(`
      UPDATE session_participants 
      SET status = 'submitted', submitted_at = ?
      WHERE session_id = ? AND participant_id = ?
    `);
    
    await updateParticipant.run(new Date().toISOString(), sessionId, participantId);

    const contributionsCount = savedCount;

    res.status(200).json({
      success: true,
      contributionsCount: contributionsCount,
      message: `Successfully saved ${contributionsCount} contribution(s)`
    });

  } catch (error) {
    console.error('Error saving contributions:', error);
    
    // Handle unique constraint violations
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({
        success: false,
        error: 'Contributions already submitted for one or more topics'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to save contributions',
      details: error.message
    });
  }
});

/**
 * API #5: Get Contributions for Voting
 * GET /api/sessions/:sessionId/contributions?state=voting
 * 
 * Purpose: Fetch all contributions with vote counts for voting view
 * Business Rules:
 * - Only returns if session is in "voting" state (when ?state=voting param)
 * - Aggregates vote counts
 * - Returns structured data matching frontend expectations
 */
router.get('/sessions/:sessionId/contributions', async (req, res) => {
  const { sessionId } = req.params;
  const { state } = req.query;

  // Check session exists
  const session = await db.prepare('SELECT session_id, session_state FROM sessions WHERE session_id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  // If state=voting param is provided, validate session is in voting state
  if (state === 'voting' && session.session_state !== 'voting') {
    return res.status(400).json({
      success: false,
      error: `Session is not in voting state. Current state: "${session.session_state}"`
    });
  }

  try {
    // Fetch all contributions with vote counts and topic/participant info
    const query = `
      SELECT 
        c.contribution_id,
        c.session_id,
        c.topic_id,
        t.topic_name,
        t.domain,
        c.participant_id,
        sp.display_name as author_name,
        c.current_status,
        c.minor_impact,
        c.disruption,
        c.reimagination,
        c.submitted_at,
        COUNT(v.vote_id)::int as votes
      FROM contributions c
      JOIN topics t ON c.topic_id = t.topic_id
      LEFT JOIN session_participants sp ON c.participant_id = sp.participant_id AND c.session_id = sp.session_id
      LEFT JOIN votes v ON c.contribution_id = v.contribution_id
      WHERE c.session_id = ?
      GROUP BY c.contribution_id, c.session_id, c.topic_id, t.topic_name, t.domain, 
               c.participant_id, sp.display_name, c.current_status, c.minor_impact, 
               c.disruption, c.reimagination, c.submitted_at, t.sort_order
      ORDER BY t.sort_order, c.submitted_at
    `;

    const contributions = await db.prepare(query).all(sessionId);

    // Transform to match frontend structure (grouped by topic)
    const topicsMap = {};
    
    contributions.forEach(contrib => {
      if (!topicsMap[contrib.topic_id]) {
        topicsMap[contrib.topic_id] = {
          id: contrib.topic_id,
          topic: contrib.topic_name,
          domain: contrib.domain,
          history: []
        };
      }

      topicsMap[contrib.topic_id].history.push({
        id: contrib.contribution_id,
        participantId: contrib.participant_id,
        author: contrib.author_name || contrib.participant_id,
        email: contrib.participant_id, // Using participantId as email (from frontend pattern)
        currentStatus: contrib.current_status,
        minorImpact: contrib.minor_impact,
        disruption: contrib.disruption,
        reimagination: contrib.reimagination,
        votes: contrib.votes,
        voters: [], // Will be populated if needed
        submittedAt: contrib.submitted_at
      });
    });

    const rows = Object.values(topicsMap);

    res.status(200).json({
      success: true,
      sessionId: sessionId,
      sessionState: session.session_state,
      contributions: rows
    });

  } catch (error) {
    console.error('Error fetching contributions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contributions',
      details: error.message
    });
  }
});

export default router;

