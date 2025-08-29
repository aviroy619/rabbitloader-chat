'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const cfg = require('../config');
const { Conversations } = require('../storage/mongo');
const { storeAdminEdit } = require('../core/kb/retriever');

const router = express.Router();

// GET /admin/logs?limit=50 (your existing endpoint)
router.get('/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '200', 10), 1000);
  const today = new Date().toISOString().slice(0,10);
  const file = path.join(cfg.logDir || './logs', `${today}.jsonl`);

  if (!fs.existsSync(file)) {
    return res.json({ ok: true, items: [], note: `no log file at ${file}` });
  }

  const lines = fs.readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .slice(-limit);

  const items = lines.map((l) => {
    try { return JSON.parse(l); } catch { return { raw: l }; }
  });

  res.json({ ok: true, items });
});

// GET /admin/stats - Get conversation statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await Conversations.getStats();
    res.json({ 
      ok: true, 
      stats: stats 
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch statistics',
      details: error.message 
    });
  }
});

// GET /admin/sessions - List all chat sessions
router.get('/sessions', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const skip = Math.max(parseInt(req.query.skip || '0', 10), 0);
    const domainId = req.query.domainId; // Optional filter by domain
    
    let sessions;
    if (domainId) {
      sessions = await Conversations.getSessionsByDomain(domainId, limit);
      // Convert to the expected format for domain filtering
      sessions = sessions.map(session => ({
        sessionId: session.sessionId,
        userId: session.userId,
        domainId: session.domainId,
        lastMsg: session.messages && session.messages.length > 0 
          ? session.messages[session.messages.length - 1].text.substring(0, 100) + '...'
          : 'No messages',
        messageCount: session.messages ? session.messages.length : 0,
        updatedAt: session.updatedAt
      }));
    } else {
      sessions = await Conversations.listSessions(limit, skip);
      // Add message count for each session
      for (let session of sessions) {
        const fullSession = await Conversations.findBySessionId(session.sessionId);
        session.messageCount = fullSession && fullSession.messages ? fullSession.messages.length : 0;
        // Truncate long messages
        if (session.lastMsg && session.lastMsg.length > 100) {
          session.lastMsg = session.lastMsg.substring(0, 100) + '...';
        }
      }
    }

    res.json({ 
      ok: true, 
      sessions, 
      total: sessions.length,
      hasMore: sessions.length === limit 
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch sessions',
      details: error.message 
    });
  }
});

// GET /admin/session/:sessionId - Get detailed session with user profile
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const conversation = await Conversations.findBySessionId(sessionId);
    
    if (!conversation) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Session not found' 
      });
    }

    // TODO: Integrate with RabbitLoader profile_v2 API to get user details
    // For now, we'll return basic info and placeholder for profile
    let profile = { 
      name: 'Unknown User', 
      email: 'unknown@example.com' 
    };

    // If you have access to RL profile API, uncomment and modify this:
    /*
    try {
      if (conversation.userId) {
        const profileResponse = await fetch(`${cfg.rabbitLoaderApiUrl}/profile_v2/${conversation.userId}`, {
          headers: { 'Authorization': `Bearer ${cfg.rabbitLoaderApiKey}` }
        });
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          profile = {
            name: profileData.name || profileData.fullName || 'Unknown User',
            email: profileData.email || 'unknown@example.com',
            company: profileData.company || null,
            plan: profileData.plan || null
          };
        }
      }
    } catch (profileError) {
      console.error('Error fetching user profile:', profileError);
      // Continue with placeholder profile
    }
    */

    const response = {
      ok: true,
      sessionId: conversation.sessionId,
      userId: conversation.userId,
      domainId: conversation.domainId,
      profile: profile,
      messages: conversation.messages || [],
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation.messages ? conversation.messages.length : 0
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch session details',
      details: error.message 
    });
  }
});

// POST /admin/edit - Edit an assistant's answer
router.post('/edit', async (req, res) => {
  try {
    const { sessionId, question, newAnswer, editor } = req.body;

    // Validate required fields
    if (!sessionId || !question || !newAnswer || !editor) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Missing required fields: sessionId, question, newAnswer, editor' 
      });
    }

    // Update the message in MongoDB
    const updateResult = await Conversations.updateAssistantMessage(
      sessionId, 
      question, 
      newAnswer, 
      editor
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Session or message not found' 
      });
    }

    // Store the edit in Pinecone admin-edits namespace
    let pineconeId = null;
    try {
      pineconeId = await storeAdminEdit(question, newAnswer, editor, sessionId);
    } catch (pineconeError) {
      console.error('Error storing admin edit in Pinecone:', pineconeError);
      // Continue even if Pinecone fails - the edit is saved in MongoDB
    }

    res.json({ 
      ok: true, 
      message: 'Answer updated successfully',
      sessionId,
      editor,
      pineconeId,
      mongoUpdated: updateResult.modifiedCount > 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error editing answer:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to edit answer',
      details: error.message 
    });
  }
});

// DELETE /admin/session/:sessionId - Delete a session
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await Conversations.deleteSession(sessionId);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Session not found' 
      });
    }

    res.json({ 
      ok: true, 
      message: 'Session deleted successfully',
      sessionId 
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to delete session',
      details: error.message 
    });
  }
});

module.exports = router;