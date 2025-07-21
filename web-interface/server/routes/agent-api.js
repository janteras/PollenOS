const express = require('express');
const router = express.Router();
const agentScoring = require('../analytics/agent-scoring');
const validationFramework = require('../analytics/validation-framework');
const pollenVirtualService = require('../services/pollen-virtual-service');

// Get all agent scores
router.get('/scores', async (req, res) => {
    try {
        const scores = await agentScoring.getAgentScores();
        res.json({ success: true, data: scores });
    } catch (error) {
        console.error('Error fetching agent scores:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch agent scores' });
    }
});

// Get validation results for a bot
router.get('/:botId/validation', async (req, res) => {
    try {
        const { botId } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        
        const results = await validationFramework.getValidationHistory(botId, limit);
        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching validation results:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch validation results' });
    }
});

// Run validation for a bot
router.post('/:botId/validate', async (req, res) => {
    try {
        const { botId } = req.params;
        const result = await validationFramework.runValidation(botId);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error running validation:', error);
        res.status(500).json({ success: false, error: 'Failed to run validation' });
    }
});

// Get Pollen Virtual metrics for a bot
router.get('/:botId/pollen-virtual', async (req, res) => {
    try {
        const { botId } = req.params;
        const days = parseInt(req.query.days) || 30;
        
        const metrics = await pollenVirtualService.getHistoricalPerformance(botId, days);
        const rank = await pollenVirtualService.getBotRank(botId);
        
        res.json({ 
            success: true, 
            data: { 
                currentRank: rank,
                historicalMetrics: metrics 
            } 
        });
    } catch (error) {
        console.error('Error fetching Pollen Virtual metrics:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch Pollen Virtual metrics' });
    }
});

// Update agent score (admin only)
router.post('/:botId/update-score', async (req, res) => {
    try {
        const { botId } = req.params;
        await agentScoring.updateAgentScore(botId);
        res.json({ success: true, message: 'Agent score updated successfully' });
    } catch (error) {
        console.error('Error updating agent score:', error);
        res.status(500).json({ success: false, error: 'Failed to update agent score' });
    }
});

module.exports = router;
