const express = require('express');
const router = express.Router();
const { scheduleTestReminder } = require('../services/reminderService');

// POST /api/test/reminder
// Test scheduling a reminder 2 minutes from now
router.post('/reminder', async (req, res) => {
  try {
    const { phone, name } = req.body;
    const key = await scheduleTestReminder(phone, name);
    res.json({
      success: true,
      message: 'Test reminder scheduled for 2 minutes from now',
      key,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;