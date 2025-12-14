import express from 'express';
import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * POST /api/sessions
 * Create a new session
 */
router.post('/sessions', (req, res) => {
  const { name, moderatorId, moderatorName, moderatorEmail } = req.body;

  if (!name || !moderatorId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: name, moderatorId'
    });
  }

  try {
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    // Create session
    db.prepare(`
      INSERT INTO sessions (session_id, name, moderator_id, session_state, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, name, moderatorId, 'setup', now);

    // Add moderator as participant
    db.prepare(`
      INSERT INTO session_participants (session_id, participant_id, display_name, email, status, joined_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, moderatorId, moderatorName || 'Moderator', moderatorEmail || moderatorId, 'joined', now);

    res.status(201).json({
      success: true,
      data: {
        sessionId,
        name,
        moderatorId,
        state: 'setup',
        createdAt: now
      }
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session',
      message: error.message
    });
  }
});

/**
 * POST /api/sessions/:sessionId/topics
 * Add a topic to a session
 */
router.post('/sessions/:sessionId/topics', (req, res) => {
  const { sessionId } = req.params;
  const { domain, topicName, sortOrder } = req.body;

  if (!domain || !topicName) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: domain, topicName'
    });
  }

  try {
    // Check if session exists
    const session = db.prepare('SELECT session_id FROM sessions WHERE session_id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const topicId = uuidv4();

    db.prepare(`
      INSERT INTO topics (topic_id, session_id, domain, topic_name, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(topicId, sessionId, domain, topicName, sortOrder || 0);

    res.status(201).json({
      success: true,
      data: {
        topicId,
        sessionId,
        domain,
        topicName,
        sortOrder: sortOrder || 0
      }
    });
  } catch (error) {
    console.error('Error adding topic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add topic',
      message: error.message
    });
  }
});

/**
 * POST /api/sessions/:sessionId/participants
 * Add a participant to a session
 */
router.post('/sessions/:sessionId/participants', (req, res) => {
  const { sessionId } = req.params;
  const { participantId, displayName, email } = req.body;

  if (!participantId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: participantId'
    });
  }

  try {
    // Check if session exists
    const session = db.prepare('SELECT session_id FROM sessions WHERE session_id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Check if participant already exists
    const existing = db.prepare(`
      SELECT participant_id FROM session_participants 
      WHERE session_id = ? AND participant_id = ?
    `).get(sessionId, participantId);

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Participant already in session'
      });
    }

    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO session_participants (session_id, participant_id, display_name, email, status, joined_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, participantId, displayName || participantId, email || participantId, 'joined', now);

    res.status(201).json({
      success: true,
      data: {
        sessionId,
        participantId,
        displayName: displayName || participantId,
        email: email || participantId,
        status: 'joined',
        joinedAt: now
      }
    });
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add participant',
      message: error.message
    });
  }
});

/**
 * PATCH /api/sessions/:sessionId/state
 * Update session state
 */
router.patch('/sessions/:sessionId/state', (req, res) => {
  const { sessionId } = req.params;
  const { state } = req.body;

  const validStates = ['setup', 'published', 'contributing', 'voting', 'voting_locked', 'final'];
  
  if (!state || !validStates.includes(state)) {
    return res.status(400).json({
      success: false,
      error: `Invalid state. Must be one of: ${validStates.join(', ')}`
    });
  }

  try {
    // Check if session exists
    const session = db.prepare('SELECT session_id FROM sessions WHERE session_id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    db.prepare(`
      UPDATE sessions 
      SET session_state = ?
      WHERE session_id = ?
    `).run(state, sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        state
      }
    });
  } catch (error) {
    console.error('Error updating session state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update session state',
      message: error.message
    });
  }
});

/**
 * GET /api/sessions/:sessionId
 * Get session details
 */
router.get('/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = db.prepare(`
      SELECT session_id, name, moderator_id, session_state, created_at
      FROM sessions
      WHERE session_id = ?
    `).get(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Get topics
    const topics = db.prepare(`
      SELECT topic_id, domain, topic_name, sort_order
      FROM topics
      WHERE session_id = ?
      ORDER BY sort_order
    `).all(sessionId);

    // Get participants
    const participants = db.prepare(`
      SELECT participant_id, display_name, email, status, joined_at, submitted_at
      FROM session_participants
      WHERE session_id = ?
    `).all(sessionId);

    res.json({
      success: true,
      data: {
        sessionId: session.session_id,
        name: session.name,
        moderatorId: session.moderator_id,
        state: session.session_state,
        createdAt: session.created_at,
        topics,
        participants
      }
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session',
      message: error.message
    });
  }
});

/**
 * GET /api/sessions
 * List all sessions (optionally filtered)
 */
router.get('/sessions', (req, res) => {
  const { state, moderatorId } = req.query;

  try {
    let query = 'SELECT session_id, name, moderator_id, session_state, created_at FROM sessions';
    const conditions = [];
    const params = [];

    if (state) {
      conditions.push('session_state = ?');
      params.push(state);
    }

    if (moderatorId) {
      conditions.push('moderator_id = ?');
      params.push(moderatorId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const sessions = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: {
        sessions: sessions.map(s => ({
          sessionId: s.session_id,
          name: s.name,
          moderatorId: s.moderator_id,
          state: s.session_state,
          createdAt: s.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list sessions',
      message: error.message
    });
  }
});

/**
 * POST /api/sessions/:sessionId/join
 * Simplified endpoint for users to join a session
 */
router.post('/sessions/:sessionId/join', (req, res) => {
  const { sessionId } = req.params;
  const { participantId, displayName, email } = req.body;

  if (!participantId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: participantId'
    });
  }

  try {
    // Check if session exists
    const session = db.prepare('SELECT session_id, name, session_state FROM sessions WHERE session_id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Check if session is joinable
    if (session.session_state === 'final') {
      return res.status(403).json({
        success: false,
        error: 'Cannot join session. Session is finalized.'
      });
    }

    // Check if participant already exists
    const existing = db.prepare(`
      SELECT participant_id FROM session_participants 
      WHERE session_id = ? AND participant_id = ?
    `).get(sessionId, participantId);

    if (existing) {
      // Already joined, return success with session info
      return res.status(200).json({
        success: true,
        message: 'Already joined session',
        data: {
          sessionId,
          sessionName: session.name,
          sessionState: session.session_state,
          participantId,
          displayName: displayName || participantId,
          status: 'joined'
        }
      });
    }

    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO session_participants (session_id, participant_id, display_name, email, status, joined_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, participantId, displayName || participantId, email || participantId, 'joined', now);

    res.status(201).json({
      success: true,
      message: 'Successfully joined session',
      data: {
        sessionId,
        sessionName: session.name,
        sessionState: session.session_state,
        participantId,
        displayName: displayName || participantId,
        email: email || participantId,
        status: 'joined',
        joinedAt: now
      }
    });
  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join session',
      message: error.message
    });
  }
});

/**
 * DELETE /api/sessions/:sessionId
 * Delete a session and all related data
 */
router.delete('/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  try {
    // Check if session exists
    const session = db.prepare('SELECT session_id FROM sessions WHERE session_id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Delete in order to respect foreign key constraints
    db.prepare('DELETE FROM votes WHERE contribution_id IN (SELECT contribution_id FROM contributions WHERE session_id = ?)').run(sessionId);
    db.prepare('DELETE FROM contributions WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM session_participants WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM topics WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session',
      message: error.message
    });
  }
});

/**
 * GET /api/sessions/:sessionId/status
 * Get submission status for all participants
 */
router.get('/sessions/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;

  try {
    // Check if session exists
    const session = db.prepare('SELECT session_id, name, session_state FROM sessions WHERE session_id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Get all participants with their submission status
    const participants = db.prepare(`
      SELECT 
        participant_id,
        display_name,
        email,
        status,
        joined_at,
        submitted_at
      FROM session_participants
      WHERE session_id = ?
      ORDER BY joined_at
    `).all(sessionId);

    // Count submitted vs pending
    const submitted = participants.filter(p => p.status === 'submitted').length;
    const pending = participants.filter(p => p.status !== 'submitted').length;

    res.json({
      success: true,
      data: {
        sessionId,
        sessionName: session.name,
        sessionState: session.session_state,
        summary: {
          total: participants.length,
          submitted,
          pending
        },
        participants: participants.map(p => ({
          participantId: p.participant_id,
          displayName: p.display_name,
          email: p.email,
          status: p.status,
          joinedAt: p.joined_at,
          submittedAt: p.submitted_at
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching submission status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch submission status',
      message: error.message
    });
  }
});

export default router;

