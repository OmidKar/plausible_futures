import { useMemo, useState, useEffect, useRef } from "react";

const defaultDraft = () => ({
  currentStatus: "",
  minorImpact: "",
  disruption: "",
  reimagination: ""
});

// Helper function to get user-specific draft localStorage key
const getDraftKey = (sessionId, userId) => {
  if (!sessionId || !userId) return null;
  return `ideation-draft-${sessionId}-${userId}`;
};

// Helper function to get session metadata key (shared for session info only)
const getSessionMetaKey = (sessionId) => {
  if (!sessionId) return null;
  return `ideation-session-meta-${sessionId}`;
};

function App() {
  
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: ""
  });
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [currentSession, setCurrentSession] = useState(() => {
    // Don't auto-load sessions - users must explicitly select one
    // This prevents cross-tab contamination where one user's session
    // appears in another user's browser
    return null;
  });
  const [showSessionBrowser, setShowSessionBrowser] = useState(false);
  const [sessionNameInput, setSessionNameInput] = useState("");
  const [joinSessionIdInput, setJoinSessionIdInput] = useState("");
  const [rows, setRows] = useState([]);
  const [structureMode, setStructureMode] = useState(true);
  const [structureFinalized, setStructureFinalized] = useState(false);
  const [sessionState, setSessionState] = useState("setup");
  const [userHasSubmitted, setUserHasSubmitted] = useState(false);
  const [submittedParticipantsCount, setSubmittedParticipantsCount] = useState(0);
  const [showCompiled, setShowCompiled] = useState(false);
  const [showSubmissionStatus, setShowSubmissionStatus] = useState(false);
  const [votingContributions, setVotingContributions] = useState(null); // Fetched from API for voting
  const [loadingContributions, setLoadingContributions] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [topicInput, setTopicInput] = useState("");

  // Initialize session browser state - default to showing browser if user has no session
  // But allow manual switching without interference

  // Sub-Session Pattern: Load session template + user's draft
  useEffect(() => {
    if (!currentSession || !user) {
      setRows([]);
      setStructureFinalized(false);
      return;
    }
    
    try {
      // 1. Load session metadata (structure, topics, state)
      const metaKey = getSessionMetaKey(currentSession.id);
      const metaSaved = localStorage.getItem(metaKey);
      let sessionMeta = metaSaved ? JSON.parse(metaSaved) : null;
      
      // 2. Load user's draft (if exists)
      const draftKey = getDraftKey(currentSession.id, user.participantId);
      const draftSaved = localStorage.getItem(draftKey);
      let userDraft = draftSaved ? JSON.parse(draftSaved) : null;
      
      if (sessionMeta) {
        // Use session structure (topics)
        const sessionRows = sessionMeta.rows || [];
        
        // If user has draft, merge it; otherwise start with empty drafts
        const rowsToSet = userDraft && userDraft.rows
          ? userDraft.rows
          : sessionRows.map(row => ({ ...row, draft: defaultDraft() }));
        
        setRows(rowsToSet);
        setStructureFinalized(sessionMeta.structureFinalized || false);
        setSessionState(sessionMeta.sessionState || "setup");
        
        // Check submission status from session metadata
        const submittedParticipants = sessionMeta.submittedParticipants || [];
        setUserHasSubmitted(submittedParticipants.includes(user.participantId));
        setSubmittedParticipantsCount(submittedParticipants.length);
      } else {
        setRows([]);
        setStructureFinalized(false);
      }
    } catch (e) {
      console.warn("Failed to load session data", e);
      setRows([]);
      setStructureFinalized(false);
    }
  }, [currentSession, user]);

  // Force contribution mode for non-moderators
  useEffect(() => {
    if (user && currentSession) {
      const isModerator = currentSession.moderator?.participantId === user.participantId;
      // Non-moderators should never be in structure mode
      // Moderators should only be in structure mode during setup
      if (!isModerator && structureMode) {
        setStructureMode(false);
      } else if (isModerator && sessionState !== "setup" && structureMode) {
        setStructureMode(false);
      }
    }
  }, [user, currentSession, structureMode, sessionState]);

  // Sub-Session Pattern: User-specific draft auto-save (lightweight)
  // Saves user's draft work locally for page refresh persistence
  useEffect(() => {
    if (!currentSession || !user) return;
    
    const draftKey = getDraftKey(currentSession.id, user.participantId);
    if (!draftKey) return;
    
    try {
      const draftData = {
        sessionId: currentSession.id,
        participantId: user.participantId,
        rows: rows,  // Contains user's draft contributions
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    } catch (e) {
      console.warn("Failed to save draft to localStorage", e);
    }
  }, [rows, currentSession, user]);

  // Sub-Session Pattern: Periodic check for session state and participant changes
  // This allows users to see when moderator enables voting, locks votes, etc.
  // Also updates moderator's view when new participants join or submit
  useEffect(() => {
    if (!currentSession) return;
    
    const checkSessionUpdates = () => {
      const metaKey = getSessionMetaKey(currentSession.id);
      if (!metaKey) return;
      
      try {
        const saved = localStorage.getItem(metaKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          
          // Check for session state changes
          const remoteState = parsed.sessionState;
          if (remoteState && remoteState !== sessionState) {
            setSessionState(remoteState);
            
            // Notify when voting is enabled (don't auto-open, let user click button)
            if (remoteState === "voting") {
              setMessage("Voting is now available! Click 'View Contributions & Vote' to see all submissions.");
            } else if (remoteState === "voting_locked") {
              setShowCompiled(false);
              setVotingContributions(null);
              setMessage("Voting has been locked. No more votes can be cast.");
            } else if (remoteState === "final") {
              setShowCompiled(false);
              setVotingContributions(null);
              setMessage("Final results are now available! Click 'Show Results' to view.");
            }
          }
          
          // Update participants list and submission count (for moderator's submission status view)
          if (parsed.participants) {
            setCurrentSession(prev => ({
              ...prev,
              participants: parsed.participants
            }));
          }
          if (parsed.submittedParticipants) {
            setSubmittedParticipantsCount(parsed.submittedParticipants.length);
          }
        }
      } catch (e) {
        console.warn("Failed to check session updates", e);
      }
    };
    
    // Check every 3 seconds for updates
    const interval = setInterval(checkSessionUpdates, 3000);
    return () => clearInterval(interval);
  }, [currentSession, sessionState]);

  const domainOptions = useMemo(() => {
    const values = rows.map((row) => row.domain).filter(Boolean);
    return Array.from(new Set(values));
  }, [rows]);

  const leaderboard = useMemo(() => {
    // Use votingContributions if available (during voting), otherwise use rows
    const sourceRows = votingContributions || rows;
    const allEntries = sourceRows.flatMap((row) =>
      row.history.map((entry) => ({
        ...entry,
        topic: row.topic,
        domain: row.domain
      }))
    );
    return allEntries
      .sort((a, b) => (b.votes || 0) - (a.votes || 0))
      .slice(0, 3);
  }, [rows, votingContributions]);

  // Memoize submission status to recalculate when rows or session data changes
  // Calculate total entries count to detect when submissions happen
  const totalEntriesCount = useMemo(() => {
    return rows.reduce((sum, row) => sum + (row.history?.length || 0), 0);
  }, [rows]);
  
  // Get submission status for current session
  // Sub-Session Pattern: Get submission status from session metadata
  const getSubmissionStatus = () => {
    if (!currentSession) return null;
    const metaKey = getSessionMetaKey(currentSession.id);
    if (!metaKey) return null;
    
    try {
      const saved = localStorage.getItem(metaKey);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      const allParticipants = parsed.participants || currentSession.participants || [];
      const submittedParticipants = parsed.submittedParticipants || [];
      
      const status = allParticipants.map((participant) => {
        const hasSubmitted = submittedParticipants.includes(participant.participantId);
        // Find submission timestamp from rows
        let submittedAt = null;
        if (hasSubmitted && parsed.rows) {
          const participantEntry = parsed.rows
            .flatMap(row => row.history || [])
            .find(entry => entry.participantId === participant.participantId);
          if (participantEntry) {
            submittedAt = participantEntry.submittedAt;
          }
        }
        
        return {
          ...participant,
          hasSubmitted,
          submittedAt
        };
      });
      
      return {
        total: allParticipants.length,
        submitted: submittedParticipants.length,
        pending: allParticipants.length - submittedParticipants.length,
        participants: status
      };
    } catch (e) {
      console.warn("Failed to get submission status", e);
      return null;
    }
  };
  
  const submissionStatus = useMemo(() => {
    return getSubmissionStatus();
  }, [rows, currentSession, userHasSubmitted, totalEntriesCount, submittedParticipantsCount]);

  const handleAuthSubmit = (event) => {
    event.preventDefault();
    if (!form.email || !form.password) {
      setMessage("Email and password are required.");
      return;
    }
    const email = form.email.toLowerCase();
    setUser({
      email: email,
      displayName: form.displayName || form.email.split("@")[0],
      participantId: email // Use email as stable participant ID
    });
    localStorage.setItem("ideation-current-user-email", email);
    setMessage(`Signed in as ${form.displayName || form.email}.`);
    setForm({ email: "", password: "", displayName: "" });
    // Show session browser if no active session
    if (!currentSession) {
      setShowSessionBrowser(true);
    }
  };

  const publishNewSession = () => {
    if (!user) {
      setMessage("Sign in first to create a session.");
      return;
    }
    if (!sessionNameInput.trim()) {
      setMessage("Enter a session name.");
      return;
    }
    if (!rows.length) {
      setMessage("Add at least one topic before publishing.");
      return;
    }
    const hasUnlocked = rows.some((row) => !row.locked);
    if (hasUnlocked) {
      setMessage("Lock all topics before publishing the session.");
      return;
    }
    // Create and publish session in one step
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newSession = {
      id: sessionId,
      name: sessionNameInput.trim(),
      moderator: {
        participantId: user.participantId,
        email: user.email,
        displayName: user.displayName
      },
      createdAt: new Date().toISOString(),
      published: true, // Published immediately
      participants: [
        {
          participantId: user.participantId,
          email: user.email,
          displayName: user.displayName,
          joinedAt: new Date().toISOString()
        }
      ]
    };
    // Sub-Session Pattern: Save session metadata (shared) + moderator's draft (isolated)
    const sessionState = "published"; // Session is published and ready for contributions
    
    // Save session metadata (shared across all users)
    const metaKey = getSessionMetaKey(sessionId);
    localStorage.setItem(
      metaKey,
      JSON.stringify({
        metadata: newSession,
        rows: rows.map(row => ({ ...row, draft: defaultDraft() })), // Template with empty drafts
        structureFinalized: true,
        published: true,
        sessionState: sessionState,
        participants: newSession.participants,
        submittedParticipants: [] // Track who has submitted
      })
    );
    
    // Save moderator's draft (isolated)
    const draftKey = getDraftKey(sessionId, user.participantId);
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        sessionId: sessionId,
        participantId: user.participantId,
        rows: rows.map(row => ({ ...row, draft: defaultDraft() })), // Start with empty drafts
        lastUpdated: new Date().toISOString()
      })
    );
    
    setCurrentSession(newSession);
    localStorage.setItem("ideation-current-session", JSON.stringify(newSession));
    localStorage.setItem("ideation-current-user-email", user.email);
    setStructureFinalized(true);
    setStructureMode(false); // Switch to contribution mode
    setSessionState(sessionState);
    setSessionNameInput("");
    setDomainInput("");
    setTopicInput("");
    setMessage(`Session "${newSession.name}" published! Participants can now join and contribute.`);
  };

  const joinSession = () => {
    if (!user) {
      setMessage("Sign in first to join a session.");
      return;
    }
    if (!joinSessionIdInput.trim()) {
      setMessage("Enter a session ID.");
      return;
    }
    // Sub-Session Pattern: Load session metadata + create user's draft
    const sessionId = joinSessionIdInput.trim();
    const metaKey = getSessionMetaKey(sessionId);
    const sessionData = localStorage.getItem(metaKey);
    if (!sessionData) {
      setMessage("Session not found. Check the session ID.");
      return;
    }
    try {
      const parsed = JSON.parse(sessionData);
      // Check if session is published
      if (!parsed.published && !parsed.metadata?.published) {
        setMessage("This session is not yet published. Wait for the moderator to publish it.");
        return;
      }
      // Get session metadata
      let sessionMeta = parsed.metadata;
      if (!sessionMeta) {
        // Try to reconstruct from available data
        sessionMeta = {
          id: sessionId,
          name: `Session ${sessionId.substr(-8)}`,
          createdAt: parsed.createdAt || new Date().toISOString(),
          moderator: parsed.moderator || { displayName: "Unknown" },
          participants: parsed.participants || []
        };
      }
      // Add current user to participants if not already there
      const participantExists = sessionMeta.participants.some(
        (p) => p.participantId === user.participantId
      );
      if (!participantExists) {
        const newParticipant = {
          participantId: user.participantId,
          email: user.email,
          displayName: user.displayName,
          joinedAt: new Date().toISOString()
        };
        sessionMeta.participants.push(newParticipant);
        parsed.participants = sessionMeta.participants;
        parsed.metadata = sessionMeta;
        localStorage.setItem(metaKey, JSON.stringify(parsed));
      }
      
      // Create user's isolated draft (sub-session)
      const draftKey = getDraftKey(sessionId, user.participantId);
      const loadedRows = parsed.rows || [];
      const userDraft = {
        sessionId: sessionId,
        participantId: user.participantId,
        rows: loadedRows.map(row => ({ ...row, draft: defaultDraft() })), // Start with empty drafts
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(draftKey, JSON.stringify(userDraft));
      
      setCurrentSession(sessionMeta);
      localStorage.setItem("ideation-current-session", JSON.stringify(sessionMeta));
      localStorage.setItem("ideation-current-user-email", user.email);
      
      // Check if this user has submitted
      const submittedParticipants = parsed.submittedParticipants || [];
      const userHasAlreadySubmitted = submittedParticipants.includes(user.participantId);
      
      setRows(userDraft.rows);
      setStructureFinalized(parsed.structureFinalized || false);
      setSessionState(parsed.sessionState || "setup");
      const isModerator = sessionMeta.moderator?.participantId === user.participantId;
      setStructureMode(isModerator && parsed.sessionState === "setup");
      setUserHasSubmitted(userHasAlreadySubmitted);
      setSubmittedParticipantsCount(submittedParticipants.length);
      setJoinSessionIdInput("");
      setShowSessionBrowser(false);
      setMessage(`Joined session "${sessionMeta.name}"!`);
    } catch (e) {
      setMessage("Failed to join session. Invalid session data.");
    }
  };

  const selectSession = (session) => {
    if (!user) {
      setMessage("Sign in first to join a session.");
      return;
    }
    // Sub-Session Pattern: Load session metadata + create user's draft
    const metaKey = getSessionMetaKey(session.id);
    const sessionData = localStorage.getItem(metaKey);
    if (!sessionData) {
      setMessage("Session not found.");
      return;
    }
    try {
      const parsed = JSON.parse(sessionData);
      // Add current user to participants if not already there
      const participantExists = session.participants.some(
        (p) => p.participantId === user.participantId
      );
      if (!participantExists) {
        const newParticipant = {
          participantId: user.participantId,
          email: user.email,
          displayName: user.displayName,
          joinedAt: new Date().toISOString()
        };
        session.participants.push(newParticipant);
        parsed.participants = session.participants;
        parsed.metadata = session;
        localStorage.setItem(metaKey, JSON.stringify(parsed));
      }
      
      // Create user's isolated draft (sub-session)
      const draftKey = getDraftKey(session.id, user.participantId);
      const loadedRows = parsed.rows || [];
      const userDraft = {
        sessionId: session.id,
        participantId: user.participantId,
        rows: loadedRows.map(row => ({ ...row, draft: defaultDraft() })), // Start with empty drafts
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(draftKey, JSON.stringify(userDraft));
      
      setCurrentSession(session);
      localStorage.setItem("ideation-current-session", JSON.stringify(session));
      localStorage.setItem("ideation-current-user-email", user.email);
      
      // Check if this user has submitted
      const submittedParticipants = parsed.submittedParticipants || [];
      const userHasAlreadySubmitted = submittedParticipants.includes(user.participantId);
      
      setRows(userDraft.rows);
      setStructureFinalized(parsed.structureFinalized || false);
      setSessionState(parsed.sessionState || "setup");
      const isModerator = session.moderator?.participantId === user.participantId;
      setStructureMode(isModerator && parsed.sessionState === "setup");
      setUserHasSubmitted(userHasAlreadySubmitted);
      setSubmittedParticipantsCount(submittedParticipants.length);
      setShowSessionBrowser(false);
      // If structure is finalized, go to contribution mode
      if (parsed.structureFinalized) {
        setStructureMode(false);
      }
      setMessage(`Joined session "${session.name}"!`);
    } catch (e) {
      setMessage("Failed to join session. Invalid session data.");
    }
  };

  const handleAddRow = () => {
    // Allow adding topics during session creation (no currentSession) or if user is moderator
    if (!user) {
      setMessage("Sign in first to add topics.");
      return;
    }
    // If there's a currentSession, verify user is moderator
    if (currentSession) {
      const isModerator = currentSession.moderator?.participantId === user.participantId;
      if (!isModerator) {
        setMessage("Only the moderator can add topics.");
        return;
      }
    }
    // During session creation (no currentSession), any signed-in user can add topics
    if (!domainInput.trim()) {
      setMessage("Set a domain before adding topics.");
      return;
    }
    if (!topicInput.trim()) {
      setMessage("Give each topic a name before adding.");
      return;
    }
    const newRow = {
      id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      domain: domainInput.trim(),
      topic: topicInput.trim(),
      locked: false,
      draft: defaultDraft(),
      history: []
    };
    setRows((prev) => [...prev, newRow]);
    setTopicInput("");
    setMessage("Topic added. Lock rows when ready to collect inputs.");
  };

  const handleLockRow = (id) => {
    // Allow locking topics during session creation (no currentSession) or if user is moderator
    if (!user) {
      setMessage("Sign in first to lock topics.");
      return;
    }
    // If there's a currentSession, verify user is moderator
    if (currentSession) {
      const isModerator = currentSession.moderator?.participantId === user.participantId;
      if (!isModerator) {
        setMessage("Only the moderator can lock topics.");
        return;
      }
    }
    // During session creation (no currentSession), any signed-in user can lock topics
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              locked: true
            }
          : row
      )
    );
    setMessage("Locked row so contributions can begin.");
  };

  const finalizeStructure = () => {
    // Only moderators can finalize structure
    if (!user || !currentSession) {
      setMessage("Sign in and join a session first.");
      return;
    }
    const isModerator = currentSession.moderator?.participantId === user.participantId;
    if (!isModerator) {
      setMessage("Only the moderator can finalize the structure.");
      return;
    }
    if (!rows.length) {
      setMessage("Add at least one topic before finalizing.");
      return;
    }
    const hasUnlocked = rows.some((row) => !row.locked);
    if (hasUnlocked) {
      setMessage("Lock all topics before finalizing structure.");
      return;
    }
    setStructureFinalized(true);
    // Save finalized state
    if (currentSession) {
      const sessionKey = `ideation-session-${currentSession.id}`;
      const existing = localStorage.getItem(sessionKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        parsed.structureFinalized = true;
        if (parsed.metadata) {
          parsed.metadata.structureFinalized = true;
        }
        localStorage.setItem(sessionKey, JSON.stringify(parsed));
      }
    }
    setMessage("Structure finalized! Click 'Publish Session' to make it available for participants.");
  };

  const publishSession = () => {
    if (!currentSession) {
      setMessage("No active session to publish.");
      return;
    }
    if (!structureFinalized) {
      setMessage("Finalize the structure before publishing.");
      return;
    }
    if (currentSession.moderator?.participantId !== user?.participantId) {
      setMessage("Only the moderator can publish the session.");
      return;
    }
    // Update session to published
    const sessionKey = `ideation-session-${currentSession.id}`;
    const existing = localStorage.getItem(sessionKey);
    if (existing) {
      const parsed = JSON.parse(existing);
      parsed.published = true;
      if (parsed.metadata) {
        parsed.metadata.published = true;
      }
      localStorage.setItem(sessionKey, JSON.stringify(parsed));
      const updatedSession = { ...currentSession, published: true };
      setCurrentSession(updatedSession);
      localStorage.setItem("ideation-current-session", JSON.stringify(updatedSession));
      setMessage("Session published! Participants can now join and contribute.");
    }
  };

  const getPublishedSessions = () => {
    const sessions = [];
    // Scan localStorage for all session keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("ideation-session-")) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.metadata && data.metadata.published) {
            sessions.push({
              ...data.metadata,
              rowCount: data.rows?.length || 0,
              participantCount: data.participants?.length || 0
            });
          }
        } catch (e) {
          // ignore invalid entries
        }
      }
    }
    return sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const handleIdentityChange = (id, field, value) => {
    // Allow editing during session creation (no currentSession) or if user is moderator
    if (!user) {
      return;
    }
    // If there's a currentSession, verify user is moderator
    if (currentSession) {
      const isModerator = currentSession.moderator?.participantId === user.participantId;
      if (!isModerator) {
        return; // Silently ignore - UI should already be disabled
      }
    }
    // During session creation (no currentSession), any signed-in user can edit
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value
            }
          : row
      )
    );
  };

  const handleDraftChange = (id, field, value) => {
    // Prevent changes if user has submitted (applies to ALL users, including moderators)
    // Check if there's a history entry for this user
    if (user && currentSession) {
      // Check if this row has a submitted entry from this user
      const row = rows.find(r => r.id === id);
      if (row) {
        const hasSubmittedEntry = row.history.some(entry => entry.participantId === user.participantId);
        if (hasSubmittedEntry) {
          return; // Silently ignore - user has already submitted
        }
      }
    }
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              draft: {
                ...row.draft,
                [field]: value
              }
            }
          : row
      )
    );
  };

  // API: Fetch all contributions for voting (from database)
  const fetchContributionsForVoting = async () => {
    if (!currentSession) return;
    
    setLoadingContributions(true);
    try {
      // TODO: Replace with actual API endpoint
      // const response = await fetch(`/api/sessions/${currentSession.id}/contributions?state=voting`, {
      //   method: 'GET',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     // Add authentication headers as needed
      //   }
      // });
      // 
      // if (!response.ok) {
      //   throw new Error(`API error: ${response.statusText}`);
      // }
      // 
      // const data = await response.json();
      // setVotingContributions(data.contributions);
      
      // Placeholder: Load from localStorage metadata (simulates API response)
      console.log('API Placeholder: Fetching contributions from database for voting');
      const metaKey = getSessionMetaKey(currentSession.id);
      if (metaKey) {
        const metaSaved = localStorage.getItem(metaKey);
        if (metaSaved) {
          const sessionMeta = JSON.parse(metaSaved);
          // Simulate API response structure
          setVotingContributions(sessionMeta.rows || []);
          setShowCompiled(true);
          setMessage("Contributions loaded! You can now vote.");
        } else {
          throw new Error("No contributions found");
        }
      }
    } catch (error) {
      console.error('Failed to fetch contributions:', error);
      setMessage('Failed to load contributions. Please try again.');
    } finally {
      setLoadingContributions(false);
    }
  };

  // TODO: Implement API call to save submissions to database
  // This function should be called after collecting submission data but before showing the snapshot
  const saveSubmissionsToAPI = async (submissionData) => {
    // PLACEHOLDER: Replace with actual API implementation
    // Expected submissionData structure:
    // {
    //   sessionId: string,
    //   participantId: string,
    //   participantEmail: string,
    //   participantName: string,
    //   submissions: [
    //     {
    //       rowId: string,
    //       domain: string,
    //       topic: string,
    //       currentStatus: string,
    //       minorImpact: string,
    //       disruption: string,
    //       reimagination: string,
    //       submittedAt: string (ISO timestamp)
    //     }
    //   ]
    // }
    
    try {
      // TODO: Replace with actual API endpoint
      // const response = await fetch('/api/sessions/{sessionId}/submissions', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     // Add authentication headers as needed
      //   },
      //   body: JSON.stringify(submissionData)
      // });
      // 
      // if (!response.ok) {
      //   throw new Error(`API error: ${response.statusText}`);
      // }
      // 
      // const result = await response.json();
      // return result;
      
      // Placeholder: Simulate API call (remove in production)
      console.log('API Placeholder: Would save submissions to database', submissionData);
      return { success: true, message: 'Submissions saved (placeholder)' };
    } catch (error) {
      console.error('Failed to save submissions to API:', error);
      throw error;
    }
  };

  const handleSubmitTable = async () => {
    if (!user) {
      setMessage("Sign in to submit your contributions.");
      return;
    }
    if (!structureFinalized) {
      setMessage("Finalize the structure before submitting contributions.");
      return;
    }
    let submittedCount = 0;
    const submissions = []; // Collect all submissions for API call
    
    // Calculate updated rows first
    const updatedRows = rows.map((row) => {
      if (!row.locked) return row;
      const hasContribution = Object.values(row.draft).some(Boolean);
      if (!hasContribution) return row;
      submittedCount++;
      const newEntry = {
        id: `h-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Ensure unique ID
        author: user.displayName,
        participantId: user.participantId, // Track who submitted this
        email: user.email, // Also include email for clarity in reports
        votes: 0, // Start with 0 votes, others can vote on it
        voters: [], // Track who voted to prevent duplicates
        submittedAt: new Date().toISOString(),
        ...row.draft
      };
      
      // Collect submission data for API
      submissions.push({
        rowId: row.id,
        domain: row.domain,
        topic: row.topic,
        currentStatus: row.draft.currentStatus || "",
        minorImpact: row.draft.minorImpact || "",
        disruption: row.draft.disruption || "",
        reimagination: row.draft.reimagination || "",
        submittedAt: newEntry.submittedAt
      });
      
      const filteredHistory = row.history.filter(
        (entry) => entry.participantId !== user.participantId
      );
      return {
        ...row,
        history: [...filteredHistory, newEntry],
        draft: defaultDraft() // Clear draft after submission
      };
    });
    
    if (submittedCount > 0) {
      // Prepare submission data for API
      const submissionData = {
        sessionId: currentSession?.id,
        participantId: user.participantId,
        participantEmail: user.email,
        participantName: user.displayName,
        submissions: submissions
      };
      
      // Sub-Session Pattern: One-shot POST to API
      try {
        await saveSubmissionsToAPI(submissionData);
        
        // On success: Clear user's draft localStorage (ephemeral state discarded)
        const draftKey = getDraftKey(currentSession.id, user.participantId);
        if (draftKey) {
          localStorage.removeItem(draftKey);
        }
        
        // Update session metadata to track submission status AND MERGE rows with history
        const metaKey = getSessionMetaKey(currentSession.id);
        const metaSaved = localStorage.getItem(metaKey);
        if (metaSaved) {
          const sessionMeta = JSON.parse(metaSaved);
          const submittedParticipants = sessionMeta.submittedParticipants || [];
          if (!submittedParticipants.includes(user.participantId)) {
            submittedParticipants.push(user.participantId);
          }
          sessionMeta.submittedParticipants = submittedParticipants;
          
          // CRITICAL: MERGE user's submissions with existing submissions
          // Don't overwrite - each user's submission adds to history
          const existingRows = sessionMeta.rows || [];
          sessionMeta.rows = existingRows.map((existingRow) => {
            const updatedRow = updatedRows.find(r => r.id === existingRow.id);
            if (updatedRow) {
              // Merge history: keep existing + add new entries
              return {
                ...existingRow,
                history: [...existingRow.history, ...updatedRow.history.filter(
                  entry => entry.participantId === user.participantId
                )]
              };
            }
            return existingRow;
          });
          
          sessionMeta.lastUpdated = new Date().toISOString();
          localStorage.setItem(metaKey, JSON.stringify(sessionMeta));
          setSubmittedParticipantsCount(submittedParticipants.length);
        }
        
        // Mark as submitted and update UI to show read-only snapshot
        setUserHasSubmitted(true);
        setRows(updatedRows);  // Show submitted values (from history)
        
        setMessage(`Submitted ${submittedCount} contribution(s)! Waiting for all participants to submit and moderator to enable voting.`);
      } catch (error) {
        console.error('Submission failed:', error);
        setMessage('Failed to submit contributions. Please try again.');
        // Don't clear draft or update state on failure
      }
    } else {
      setMessage("No contributions to submit. Fill in at least one cell before submitting.");
    }
  };

  const handleVote = async (rowId, entryId) => {
    if (!user) {
      setMessage("Sign in to vote on entries.");
      return;
    }
    if (!currentSession) {
      setMessage("Join a session first.");
      return;
    }
    if (sessionState !== "voting") {
      setMessage("Voting is not currently enabled. Wait for the moderator to enable voting.");
      return;
    }
    
    // Find the entry to vote on
    const targetRow = votingContributions?.find(r => r.id === rowId);
    const targetEntry = targetRow?.history?.find(e => e.id === entryId);
    
    if (!targetEntry) {
      setMessage("Entry not found.");
      return;
    }
    
    // Prevent self-voting
    if (targetEntry.participantId === user.participantId) {
      setMessage("You cannot vote on your own entry.");
      return;
    }
    
    // Check if already voted
    const voters = targetEntry.voters || [];
    if (voters.includes(user.participantId)) {
      setMessage("You have already voted on this entry.");
      return;
    }
    
    // TODO: Call API to record vote
    // const voteData = {
    //   contributionId: entryId,
    //   voterId: user.participantId
    // };
    // await fetch(`/api/sessions/${currentSession.id}/votes`, {
    //   method: 'POST',
    //   body: JSON.stringify(voteData)
    // });
    
    // Update local votingContributions state
    setVotingContributions((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          history: row.history.map((entry) => {
            if (entry.id !== entryId) return entry;
            return {
              ...entry,
              votes: (entry.votes || 0) + 1,
              voters: [...voters, user.participantId]
            };
          })
        };
      })
    );
    
    // Also update metadata for persistence
    const metaKey = getSessionMetaKey(currentSession.id);
    if (metaKey) {
      try {
        const metaSaved = localStorage.getItem(metaKey);
        if (metaSaved) {
          const sessionMeta = JSON.parse(metaSaved);
          sessionMeta.rows = sessionMeta.rows.map((row) => {
            if (row.id !== rowId) return row;
            return {
              ...row,
              history: row.history.map((entry) => {
                if (entry.id !== entryId) return entry;
                return {
                  ...entry,
                  votes: (entry.votes || 0) + 1,
                  voters: [...(entry.voters || []), user.participantId]
                };
              })
            };
          });
          localStorage.setItem(metaKey, JSON.stringify(sessionMeta));
        }
      } catch (e) {
        console.warn("Failed to save vote to metadata", e);
      }
    }
    
    setMessage("Vote recorded!");
  };

  const enableVoting = () => {
    if (!currentSession || !user) {
      setMessage("Session or user not found.");
      return;
    }
    const isModerator = currentSession.moderator?.participantId === user.participantId;
    if (!isModerator) {
      setMessage("Only the moderator can enable voting.");
      return;
    }
    if (sessionState !== "published" && sessionState !== "contributing") {
      setMessage("Voting can only be enabled after contributions are submitted.");
      return;
    }
    const newState = "voting";
    updateSessionState(newState);
    // Don't auto-open - users will click button to fetch from API
    setMessage("Voting enabled! Participants will be able to view contributions and vote.");
  };

  const lockVotes = () => {
    if (!currentSession || !user) {
      setMessage("Session or user not found.");
      return;
    }
    const isModerator = currentSession.moderator?.participantId === user.participantId;
    if (!isModerator) {
      setMessage("Only the moderator can lock votes.");
      return;
    }
    if (sessionState !== "voting") {
      setMessage("Votes can only be locked when voting is active.");
      return;
    }
    const newState = "voting_locked";
    updateSessionState(newState);
    setMessage("Votes locked! No more voting allowed.");
  };

  const publishFinalView = () => {
    if (!currentSession || !user) {
      setMessage("Session or user not found.");
      return;
    }
    const isModerator = currentSession.moderator?.participantId === user.participantId;
    if (!isModerator) {
      setMessage("Only the moderator can publish the final view.");
      return;
    }
    if (sessionState !== "voting_locked") {
      setMessage("Final view can only be published after votes are locked.");
      return;
    }
    const newState = "final";
    updateSessionState(newState);
    setShowCompiled(true);
    setMessage("Final view published! All participants can now view results and download the report.");
  };

  // Sub-Session Pattern: Update session state in metadata
  const updateSessionState = (newState) => {
    if (!currentSession) return;
    const metaKey = getSessionMetaKey(currentSession.id);
    if (!metaKey) return;
    
    const existing = localStorage.getItem(metaKey);
    if (existing) {
      const parsed = JSON.parse(existing);
      parsed.sessionState = newState;
      if (parsed.metadata) {
        parsed.metadata.sessionState = newState;
      }
      parsed.lastUpdated = new Date().toISOString();
      localStorage.setItem(metaKey, JSON.stringify(parsed));
      setSessionState(newState);
    }
  };

  const clearSession = () => {
    if (confirm("Clear all session data? This will reset the table and structure.")) {
      if (currentSession && user) {
        // Sub-Session Pattern: Clear user's draft + session metadata
        const draftKey = getDraftKey(currentSession.id, user.participantId);
        const metaKey = getSessionMetaKey(currentSession.id);
        if (draftKey) localStorage.removeItem(draftKey);
        if (metaKey) localStorage.removeItem(metaKey);
        localStorage.removeItem("ideation-current-session");
      }
      setCurrentSession(null);
      setRows([]);
      setStructureFinalized(false);
      setStructureMode(true);
      setShowCompiled(false);
      setUserHasSubmitted(false);
      setMessage("Session cleared. Create or join a new session to continue.");
    }
  };

  const downloadReport = () => {
    if (!currentSession) {
      setMessage("No active session to download.");
      return;
    }
    
    // Load all contributions from metadata (for complete report)
    const metaKey = getSessionMetaKey(currentSession.id);
    let allRows = rows;
    let participants = currentSession.participants || [];
    
    if (metaKey) {
      try {
        const metaSaved = localStorage.getItem(metaKey);
        if (metaSaved) {
          const sessionMeta = JSON.parse(metaSaved);
          allRows = sessionMeta.rows || rows;
          participants = sessionMeta.participants || participants;
        }
      } catch (e) {
        console.warn("Failed to load complete session data for report", e);
      }
    }
    
    // Generate clean, focused report structure
    const payload = {
      session: {
        id: currentSession.id,
        name: currentSession.name,
        createdAt: currentSession.createdAt,
        moderator: {
          displayName: currentSession.moderator.displayName,
          email: currentSession.moderator.email
        },
        participants: participants.map(p => ({
          displayName: p.displayName,
          email: p.email,
          joinedAt: p.joinedAt
        }))
      },
      generatedAt: new Date().toISOString(),
      topics: allRows.map((row) => {
        const contributions = row.history.map((entry) => ({
          author: entry.author,
          authorEmail: entry.email,
          currentStatus: entry.currentStatus || "",
          minorImpact: entry.minorImpact || "",
          disruption: entry.disruption || "",
          reimagination: entry.reimagination || "",
          votes: entry.votes || 0,
          submittedAt: entry.submittedAt
        }));
        
        // Calculate total votes for this topic
        const totalVotes = contributions.reduce((sum, c) => sum + c.votes, 0);
        
        return {
          domain: row.domain,
          topic: row.topic,
          totalVotes: totalVotes,
          contributions: contributions.sort((a, b) => b.votes - a.votes) // Sort by votes desc
        };
      }).sort((a, b) => b.totalVotes - a.totalVotes) // Sort topics by total votes
    };
    
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ideation-report-${currentSession.name.replace(/[^a-z0-9]/gi, "-")}-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Session report downloaded!");
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Ideation Table</p>
          <h1>Collaborative, session-driven AI future mapping</h1>
          <p>
            Pick a domain, add topics, lock the structure, and then gather
            AI-driven insights from participants.
          </p>
        </div>
        <div className="auth-panel">
          <div className="auth-tabs">
            {["login", "signup"].map((mode) => (
              <button
                key={mode}
                className={authMode === mode ? "active" : ""}
                onClick={() => setAuthMode(mode)}
              >
                {mode === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                required
                minLength={6}
              />
            </label>
            {authMode === "signup" && (
              <label>
                Display name
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      displayName: event.target.value
                    }))
                  }
                />
              </label>
            )}
            <button type="submit">
              {authMode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          {message && <p className="hero-message">{message}</p>}
        </div>
      </header>

      <main>
        {message && (
          <div className="status-bar">
            <span>{message}</span>
          </div>
        )}
        {user && !currentSession && (
          <section className="session-management">
            <h2>Session Management</h2>
            <div className="session-tabs">
              <button
                className={!showSessionBrowser ? "active" : ""}
                onClick={() => setShowSessionBrowser(false)}
              >
                Create Session
              </button>
              <button
                className={showSessionBrowser ? "active" : ""}
                onClick={() => setShowSessionBrowser(true)}
              >
                Browse Sessions
              </button>
            </div>
            {!showSessionBrowser ? (
              <div className="session-setup-panel">
                <h3>Create New Session</h3>
                <p>Set up your session: enter a name, add domains and topics, then publish when ready.</p>
                
                <div className="session-name-section">
                  <label>
                    <strong>Session Name</strong>
                    <input
                      type="text"
                      placeholder="e.g., 'Q1 Planning' or 'Finance AI Impact'"
                      value={sessionNameInput}
                      onChange={(e) => setSessionNameInput(e.target.value)}
                    />
                  </label>
                </div>

                <div className="structure-setup-section">
                  <h4>Add Topics</h4>
                  <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "1rem" }}>
                    Add domains and topics. Lock each topic when ready. All topics must be locked before publishing.
                  </p>
                  
                  <div className="row-actions">
                    <div className="row-inputs">
                      <label>
                        Domain
                        <input
                          list="domains"
                          value={domainInput}
                          onChange={(event) => setDomainInput(event.target.value)}
                        />
                        <datalist id="domains">
                          {domainOptions.map((domain) => (
                            <option key={domain} value={domain} />
                          ))}
                        </datalist>
                      </label>
                      <label>
                        Topic
                        <input
                          type="text"
                          placeholder="Ex: Fraud detection"
                          value={topicInput}
                          onChange={(event) => setTopicInput(event.target.value)}
                        />
                      </label>
                    </div>
                    <button className="primary" onClick={handleAddRow}>
                      Add topic
                    </button>
                  </div>

                  {rows.length > 0 ? (
                    <div className="structure-rows">
                      {rows.map((row) => (
                        <div key={row.id} className="structure-row">
                          <div className="structure-inputs">
                            <input
                              value={row.domain}
                              onChange={(event) =>
                                handleIdentityChange(row.id, "domain", event.target.value)
                              }
                              disabled={row.locked}
                            />
                            <input
                              value={row.topic}
                              onChange={(event) =>
                                handleIdentityChange(row.id, "topic", event.target.value)
                              }
                              disabled={row.locked}
                            />
                          </div>
                          <div>
                            <button
                              onClick={() => handleLockRow(row.id)}
                              disabled={row.locked || !row.topic.trim()}
                              className={row.locked ? "ghost" : "primary"}
                            >
                              {row.locked ? "✓ Locked" : "Lock topic"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: "#64748b", fontStyle: "italic", marginTop: "1rem" }}>
                      No topics yet. Add at least one topic for the chosen domain.
                    </p>
                  )}

                  <div className="publish-actions">
                    {rows.length > 0 && rows.every((row) => row.locked) ? (
                      <button className="primary" onClick={publishNewSession}>
                        Publish Session
                      </button>
                    ) : (
                      <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                        {rows.length === 0
                          ? "Add at least one topic to publish"
                          : "Lock all topics before publishing"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="session-browser">
                <h3>Available Sessions</h3>
                {getPublishedSessions().length === 0 ? (
                  <p style={{ color: "#64748b", fontStyle: "italic" }}>
                    No published sessions available. Create a session to get started.
                  </p>
                ) : (
                  <div className="session-list">
                    {getPublishedSessions().map((session) => (
                      <div key={session.id} className="session-card">
                        <div className="session-card-header">
                          <h4>{session.name}</h4>
                          <button
                            className="primary"
                            onClick={() => selectSession(session)}
                          >
                            Join
                          </button>
                        </div>
                        <div className="session-card-details">
                          <p>
                            <strong>Moderator:</strong> {session.moderator?.displayName} (
                            {session.moderator?.email})
                          </p>
                          <p>
                            <strong>Topics:</strong> {session.rowCount} |{" "}
                            <strong>Participants:</strong> {session.participantCount}
                          </p>
                          <p>
                            <strong>Session ID:</strong> <code>{session.id}</code>
                          </p>
                          <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
                            Created: {new Date(session.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
        {user && currentSession && (
          <section className="session-info">
            <div className="session-header">
              <div>
                <h2>{currentSession.name}</h2>
                <p>
                  Session ID: <code>{currentSession.id}</code>
                </p>
                <p>
                  Moderator: <strong>{currentSession.moderator?.displayName || "Unknown"}</strong>{" "}
                  ({currentSession.moderator?.email})
                </p>
                <p>
                  Participants: {currentSession.participants?.length || 0}
                  {currentSession.participants?.length > 0 && (
                    <span>
                      {" "}
                      - {currentSession.participants.map((p) => p.displayName).join(", ")}
                    </span>
                  )}
                </p>
                {currentSession.moderator?.participantId === user.participantId && (
                  <p style={{ color: "#1d4ed8", fontWeight: "bold" }}>
                    👑 You are the moderator
                  </p>
                )}
                {currentSession.published ? (
                  <p style={{ color: "#059669", fontWeight: "bold" }}>
                    ✓ Published - Available for participants
                  </p>
                ) : structureFinalized ? (
                  <p style={{ color: "#f59e0b", fontWeight: "bold" }}>
                    ⚠ Structure finalized - Publish to allow participants to join
                  </p>
                ) : (
                  <p style={{ color: "#64748b" }}>
                    Draft - Finalize structure to publish
                  </p>
                )}
              </div>
              <div>
                <button
                  className="ghost"
                  onClick={() => {
                    setCurrentSession(null);
                    localStorage.removeItem("ideation-current-session");
                    setRows([]);
                    setStructureFinalized(false);
                    setShowSessionBrowser(true);
                    setMessage("Left session. Create or join a new one to continue.");
                  }}
                >
                  Leave Session
                </button>
              </div>
            </div>
          </section>
        )}
        {user && currentSession && (() => {
          const isModerator = currentSession.moderator?.participantId === user.participantId;
          const getStateMessage = () => {
            switch (sessionState) {
              case "setup":
                return isModerator ? "Setting up session structure..." : "Session is being set up...";
              case "published":
                return isModerator 
                  ? "Session published. Participants can join and contribute."
                  : userHasSubmitted
                  ? "✓ You have submitted your contributions. Waiting for all participants to submit and moderator to enable voting."
                  : "Fill in your contributions for each topic, then submit.";
              case "contributing":
                return isModerator
                  ? "Participants are contributing. Monitor submissions."
                  : userHasSubmitted
                  ? "✓ You have submitted your contributions. Waiting for all participants to submit and moderator to enable voting."
                  : "Fill in your contributions for each topic, then submit.";
              case "voting":
                return isModerator
                  ? "Voting is active. Participants can vote on contributions."
                  : showCompiled 
                    ? "Review contributions and vote on ideas you like."
                    : "Voting is now available! Click 'View Contributions & Vote' button above to see all submissions.";
              case "voting_locked":
                return isModerator
                  ? "Votes are locked. Review results and publish final view when ready."
                  : "Voting is complete. Waiting for moderator to publish final view.";
              case "final":
                return "Final view published! Review results and download the report.";
              default:
                return "";
            }
          };
          return (
            <section className="session-toolbar">
              <div>
                <strong>Signed in as {user.displayName}</strong>
                <p>{getStateMessage()}</p>
                {sessionState === "final" && (
                  <p style={{ color: "#059669", fontWeight: "bold", marginTop: "0.5rem" }}>
                    📊 Final results available - Download report below
                  </p>
                )}
              </div>
              <div className="toolbar-actions">
                {/* Moderator controls for stage transitions */}
                {isModerator && sessionState === "published" && (
                  <button className="primary" onClick={enableVoting}>
                    Enable Voting
                  </button>
                )}
                {isModerator && sessionState === "voting" && (
                  <button className="primary" onClick={lockVotes}>
                    Lock Votes
                  </button>
                )}
                {isModerator && sessionState === "voting_locked" && (
                  <button className="primary" onClick={publishFinalView}>
                    Publish Final View
                  </button>
                )}
                {/* Submission Status - Moderator only, during contribution phase */}
                {isModerator && (sessionState === "published" || sessionState === "contributing") && (
                  <button
                    onClick={() => setShowSubmissionStatus((prev) => !prev)}
                    className={showSubmissionStatus ? "primary" : "ghost"}
                    title="View participant submission status"
                  >
                    {showSubmissionStatus ? "Hide Status" : "Submission Status"}
                  </button>
                )}
                {/* Voting: Fetch contributions from API */}
                {sessionState === "voting" && !showCompiled && (
                  <button
                    onClick={fetchContributionsForVoting}
                    className="primary"
                    disabled={loadingContributions}
                    style={{ fontSize: "1.1rem", padding: "0.75rem 1.5rem" }}
                  >
                    {loadingContributions ? "Loading..." : "🗳️ View Contributions & Vote"}
                  </button>
                )}
                {/* Hide button after contributions loaded */}
                {sessionState === "voting" && showCompiled && (
                  <button
                    onClick={() => {
                      setShowCompiled(false);
                      setVotingContributions(null);
                    }}
                    className="ghost"
                  >
                    Hide Voting View
                  </button>
                )}
                {/* Show compiled view button - only in voting_locked and final states */}
                {(sessionState === "voting_locked" || sessionState === "final") && (
                  <button
                    onClick={() => setShowCompiled((prev) => !prev)}
                    className={showCompiled ? "primary" : "ghost"}
                  >
                    {showCompiled ? "Hide Results" : "Show Results"}
                  </button>
                )}
                {isModerator && (
                  <button
                    onClick={clearSession}
                    className="ghost"
                    style={{ color: "#dc2626" }}
                    title="Clear all session data (for testing)"
                  >
                    Clear session
                  </button>
                )}
              </div>
            </section>
          );
        })()}

        {/* Submission Status Panel - Moderator Only */}
        {user && currentSession && (() => {
          const isModerator = currentSession.moderator?.participantId === user.participantId;
          if (!isModerator || !showSubmissionStatus || (sessionState !== "published" && sessionState !== "contributing")) {
            return null;
          }
          // Use memoized submission status (recalculates when rows or session data changes)
          const status = submissionStatus;
          if (!status) return null;
          
          return (
            <section className="submission-status-panel" style={{
              margin: "1rem 0",
              padding: "1.5rem",
              background: "#f8fafc",
              borderRadius: "0.5rem",
              border: "1px solid #e2e8f0"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.25rem" }}>📊 Submission Status</h3>
                <button
                  onClick={() => setShowSubmissionStatus(false)}
                  className="ghost"
                  style={{ fontSize: "0.875rem" }}
                >
                  ✕ Close
                </button>
              </div>
              
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
                gap: "1rem",
                marginBottom: "1.5rem"
              }}>
                <div style={{ 
                  padding: "1rem", 
                  background: "white", 
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0"
                }}>
                  <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Total Participants</div>
                  <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#1e293b" }}>{status.total}</div>
                </div>
                <div style={{ 
                  padding: "1rem", 
                  background: "#f0fdf4", 
                  borderRadius: "0.5rem",
                  border: "1px solid #86efac"
                }}>
                  <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Submitted</div>
                  <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#059669" }}>{status.submitted}</div>
                </div>
                <div style={{ 
                  padding: "1rem", 
                  background: "#fefce8", 
                  borderRadius: "0.5rem",
                  border: "1px solid #fde047"
                }}>
                  <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Pending</div>
                  <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#ca8a04" }}>{status.pending}</div>
                </div>
                <div style={{ 
                  padding: "1rem", 
                  background: "white", 
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0"
                }}>
                  <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Completion</div>
                  <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#1e293b" }}>
                    {status.total > 0 ? Math.round((status.submitted / status.total) * 100) : 0}%
                  </div>
                </div>
              </div>

              <div style={{ 
                background: "white", 
                borderRadius: "0.5rem",
                border: "1px solid #e2e8f0",
                overflow: "hidden"
              }}>
                <div style={{ 
                  padding: "0.75rem 1rem", 
                  background: "#f1f5f9", 
                  borderBottom: "1px solid #e2e8f0",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  color: "#475569"
                }}>
                  Participant Details
                </div>
                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                  {status.participants.map((participant, idx) => (
                    <div
                      key={participant.participantId || idx}
                      style={{
                        padding: "1rem",
                        borderBottom: idx < status.participants.length - 1 ? "1px solid #e2e8f0" : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                          {participant.displayName || participant.email}
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                          {participant.email}
                        </div>
                        {participant.hasSubmitted && participant.submittedAt && (
                          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                            Submitted: {new Date(participant.submittedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div style={{ marginLeft: "1rem" }}>
                        {participant.hasSubmitted ? (
                          <span style={{
                            padding: "0.375rem 0.75rem",
                            background: "#f0fdf4",
                            color: "#059669",
                            borderRadius: "9999px",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.375rem"
                          }}>
                            ✓ Submitted
                          </span>
                        ) : (
                          <span style={{
                            padding: "0.375rem 0.75rem",
                            background: "#fefce8",
                            color: "#ca8a04",
                            borderRadius: "9999px",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.375rem"
                          }}>
                            ⏳ Pending
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })()}

        {user && currentSession && (() => {
          const isModerator = currentSession.moderator?.participantId === user.participantId;
          // Force contribution mode for non-moderators
          if (!isModerator && structureMode) {
            setStructureMode(false);
          }
          
          // Show structure mode only for moderator in setup state
          const showStructureMode = isModerator && sessionState === "setup" && structureMode;
          // Show contribution mode in published/contributing states
          // Always show for moderators, show for users (even after submission to display their submitted values)
          const showContributionMode = (sessionState === "published" || sessionState === "contributing");
          // Show waiting message if user submitted but voting not enabled (but don't show if contribution mode is showing submitted values)
          const showWaitingMessage = false; // Removed - showing submitted values in contribution mode instead
          
          return (
            <section className="table-panel">
              {/* Structure mode - only for moderator in setup */}
              {showStructureMode && (
                <>
                  {isModerator && (
                    <div className="row-actions">
                      <div className="row-inputs">
                        <label>
                          Domain
                          <input
                            list="domains"
                            value={domainInput}
                            onChange={(event) => setDomainInput(event.target.value)}
                          />
                          <datalist id="domains">
                            {domainOptions.map((domain) => (
                              <option key={domain} value={domain} />
                            ))}
                          </datalist>
                        </label>
                        <label>
                          Topic
                          <input
                            type="text"
                            placeholder="Ex: Fraud detection"
                            value={topicInput}
                            onChange={(event) => setTopicInput(event.target.value)}
                          />
                        </label>
                      </div>
                      <button className="primary" onClick={handleAddRow}>
                        Add topic
                      </button>
                    </div>
                  )}
                  <div className="structure-mode">
                    <h2>Structure mode</h2>
                    <p>
                      Pick a domain, add topics, and lock them. When every topic is locked,
                      finalize the structure to open contributions.
                    </p>
                    {rows.length === 0 && (
                      <p className="row-hint">
                        No topics yet. Add at least one topic for the chosen domain.
                      </p>
                    )}
                    {rows.map((row) => (
                      <div key={row.id} className="structure-row">
                        <div className="structure-inputs">
                          <input
                            value={row.domain}
                            onChange={(event) =>
                              handleIdentityChange(row.id, "domain", event.target.value)
                            }
                            disabled={row.locked}
                          />
                          <input
                            value={row.topic}
                            onChange={(event) =>
                              handleIdentityChange(row.id, "topic", event.target.value)
                            }
                            disabled={row.locked}
                          />
                        </div>
                        <div>
                          <button
                            onClick={() => handleLockRow(row.id)}
                            disabled={row.locked || !row.topic.trim()}
                            className="ghost"
                          >
                            {row.locked ? "Locked" : "Lock topic"}
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="submit-actions">
                      {!structureFinalized ? (
                        <button className="primary" onClick={finalizeStructure}>
                          Finalize structure
                        </button>
                      ) : (
                        <button className="primary" onClick={publishNewSession}>
                          Publish Session
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Waiting message - user submitted but voting not enabled */}
              {showWaitingMessage && (
                <div className="waiting-message" style={{ 
                  padding: "2rem", 
                  textAlign: "center", 
                  background: "#f1f5f9", 
                  borderRadius: "1rem",
                  margin: "1rem 0"
                }}>
                  <h3>✓ Your contributions have been submitted!</h3>
                  <p>Waiting for all participants to submit and moderator to enable voting.</p>
                  <p style={{ fontSize: "0.9rem", color: "#64748b", marginTop: "0.5rem" }}>
                    You'll be notified when voting begins.
                  </p>
                </div>
              )}

              {/* Contribution mode - for published/contributing states */}
              {showContributionMode && (
                <div className="contribution-mode">
                  <h2>Contribution mode</h2>
                  {rows.map((row) => (
                    <div
                      key={row.id}
                      className={`contribution-row ${row.locked ? "locked" : "draft"}`}
                    >
                      <div className="row-header">
                        <div>
                          <p className="row-domain">{row.domain}</p>
                          <h3>{row.topic}</h3>
                        </div>
                        <span className="row-pill">
                          {row.locked ? "Locked for contributions" : "Waiting on structure"}
                        </span>
                      </div>
                      {row.locked ? (() => {
                        // Get submitted entry for current user - check history first
                        // This ensures we show submitted values even if userHasSubmitted flag hasn't updated yet
                        // Check for ALL users (including moderators)
                        const userSubmittedEntry = user
                          ? row.history.find(entry => entry.participantId === user.participantId)
                          : null;
                        
                        // If we found a submitted entry, user has definitely submitted
                        const hasSubmittedEntry = !!userSubmittedEntry;
                        
                        // Use submitted values if entry exists in history, otherwise use draft
                        const getFieldValue = (field) => {
                          if (userSubmittedEntry) {
                            const value = userSubmittedEntry[field];
                            return value !== undefined && value !== null ? String(value) : "";
                          }
                          return row.draft[field] || "";
                        };
                        
                        return (
                          <div className="textarea-grid">
                            {hasSubmittedEntry && (
                              <div style={{
                                gridColumn: "1 / -1",
                                padding: "0.75rem 1rem",
                                background: "#f0fdf4",
                                border: "1px solid #86efac",
                                borderRadius: "0.5rem",
                                marginBottom: "1rem"
                              }}>
                                <p style={{ margin: 0, color: "#059669", fontWeight: "600", fontSize: "0.875rem" }}>
                                  ✓ You have submitted your contributions. Thank you! Waiting for moderator to enable voting.
                                </p>
                              </div>
                            )}
                            {[
                              {
                                label: "Current status",
                                field: "currentStatus",
                                hint: "How is this handled today?"
                              },
                              {
                                label: "Minor impact by AI",
                                field: "minorImpact",
                                hint: "Incremental automation possibilities."
                              },
                              {
                                label: "Disruption by AI",
                                field: "disruption",
                                hint: "Risks or transformative ideas."
                              },
                              {
                                label: "Reimagination by AI",
                                field: "reimagination",
                                hint: "What would you reimagine from scratch?"
                              }
                            ].map(({ label, field, hint }) => (
                              <label key={field}>
                                <span>
                                  {label}
                                  <small>{hint}</small>
                                </span>
                                <textarea
                                  value={getFieldValue(field)}
                                  onChange={(event) =>
                                    handleDraftChange(row.id, field, event.target.value)
                                  }
                                  placeholder="Type your idea here..."
                                  rows={3}
                                  disabled={hasSubmittedEntry}
                                  style={{
                                    ...(hasSubmittedEntry ? {
                                      background: "#f8fafc",
                                      cursor: "not-allowed",
                                      opacity: 0.9
                                    } : {})
                                  }}
                                />
                              </label>
                            ))}
                          </div>
                        );
                      })() : (
                        <p className="row-hint">
                          Lock this topic first to begin contributing text.
                        </p>
                      )}
                    </div>
                  ))}
                  {!userHasSubmitted && (
                    <div className="submit-actions">
                      <button className="primary" onClick={handleSubmitTable}>
                        Submit table
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Final state - show message that compiled view is available */}
              {sessionState === "final" && !showCompiled && (
                <div className="final-message" style={{ 
                  padding: "2rem", 
                  textAlign: "center", 
                  background: "#f0fdf4", 
                  borderRadius: "1rem",
                  margin: "1rem 0",
                  border: "2px solid #059669"
                }}>
                  <h3>📊 Final View Published!</h3>
                  <p>Click "Show compiled view" above to see all contributions and voting results.</p>
                  <p style={{ fontSize: "0.9rem", color: "#64748b", marginTop: "0.5rem" }}>
                    Download the report from the compiled view.
                  </p>
                </div>
              )}
            </section>
          );
        })()}

        {user && showCompiled && (sessionState === "voting" || sessionState === "voting_locked" || sessionState === "final") && (() => {
          // Sub-Session Pattern: Use fetched contributions from API
          // In voting state: use votingContributions (fetched from API)
          // In other states: load from metadata
          let allRows = rows; // Default
          
          if (sessionState === "voting" && votingContributions) {
            // Use API-fetched contributions for voting
            allRows = votingContributions;
          } else {
            // For voting_locked and final states, load from metadata
            const metaKey = getSessionMetaKey(currentSession?.id);
            if (metaKey) {
              try {
                const metaSaved = localStorage.getItem(metaKey);
                if (metaSaved) {
                  const sessionMeta = JSON.parse(metaSaved);
                  allRows = sessionMeta.rows || rows;
                }
              } catch (e) {
                console.warn("Failed to load submissions", e);
              }
            }
          }
          
          return (
            <section className="compiled-panel">
              <h2>{sessionState === "voting" ? "Voting View" : sessionState === "final" ? "Final Results" : "Compiled View"}</h2>
              {sessionState === "final" && (
                <div style={{ 
                  padding: "1rem", 
                  background: "#f0fdf4", 
                  borderRadius: "0.5rem",
                  marginBottom: "1rem",
                  border: "2px solid #059669"
                }}>
                  <h3 style={{ margin: "0 0 0.5rem 0", color: "#059669" }}>📊 Final Results</h3>
                  <p style={{ margin: 0, fontSize: "0.9rem" }}>
                    Voting is complete. All results are final. Download the report below.
                  </p>
                </div>
              )}
              {allRows.map((row) => (
              <div key={row.id} className="compiled-row">
                <header className="compiled-header">
                  <div>
                    <p className="row-domain">{row.domain}</p>
                    <h3>{row.topic}</h3>
                  </div>
                  <div className="compiled-scores">
                    {row.history.length ? (
                      <p>
                        {row.history.reduce((sum, entry) => sum + (entry.votes || 0), 0)} votes
                      </p>
                    ) : (
                      <p>No votes yet</p>
                    )}
                  </div>
                </header>
                <div className="compiled-columns">
                  {row.history.map((entry) => (
                    <article key={entry.id}>
                      <div className="entry-header">
                        <h4>
                          {entry.author} <span>({entry.votes || 0} votes)</span>
                        </h4>
                        {(() => {
                          const hasVoted = entry.voters?.includes(user?.participantId);
                          const isOwnEntry = entry.participantId === user?.participantId;
                          const votingEnabled = sessionState === "voting";
                          const canVote = votingEnabled && user && !hasVoted && !isOwnEntry;
                          return (
                            <button
                              className="vote-button"
                              onClick={() => handleVote(row.id, entry.id)}
                              disabled={!canVote || sessionState !== "voting"}
                              title={
                                sessionState !== "voting"
                                  ? "Voting is not currently enabled"
                                  : !user
                                  ? "Sign in to vote"
                                  : isOwnEntry
                                  ? "You cannot vote on your own entry"
                                  : hasVoted
                                  ? "You have already voted on this entry"
                                  : "Vote for this entry"
                              }
                              style={{
                                opacity: canVote ? 1 : 0.5,
                                cursor: canVote ? "pointer" : "not-allowed"
                              }}
                            >
                              {sessionState === "voting" 
                                ? (hasVoted ? "✓ Voted" : isOwnEntry ? "Your entry" : "↑ Vote")
                                : "Votes locked"}
                            </button>
                          );
                        })()}
                      </div>
                      <p>
                        <strong>Status:</strong> {entry.currentStatus}
                      </p>
                      <p>
                        <strong>Minor impact:</strong> {entry.minorImpact}
                      </p>
                      <p>
                        <strong>Disruption:</strong> {entry.disruption}
                      </p>
                      <p>
                        <strong>Reimagination:</strong> {entry.reimagination}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
            <div className="leaderboard">
              <h3>Top voted submissions</h3>
              {leaderboard.length > 0 ? (
                leaderboard.map((entry) => (
                  <div key={entry.id} className="leaderboard-entry">
                    <strong>{entry.topic}</strong>
                    <span>
                      {entry.author} · {entry.domain}
                    </span>
                    <span className="score-badge">{entry.votes} votes</span>
                  </div>
                ))
              ) : (
                <p style={{ color: "#64748b", fontStyle: "italic" }}>No votes yet</p>
              )}
            </div>
            {sessionState === "final" && (
              <div className="submit-actions" style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "2px solid #e2e8f0" }}>
                <button className="primary" onClick={downloadReport} style={{ fontSize: "1.1rem", padding: "0.75rem 2rem" }}>
                  📥 Download Report
                </button>
                <p style={{ fontSize: "0.9rem", color: "#64748b", marginTop: "0.5rem" }}>
                  Download the complete session report with all contributions and voting results.
                </p>
              </div>
            )}
          </section>
        );
        })()}
      </main>
    </div>
  );
}

export default App;

