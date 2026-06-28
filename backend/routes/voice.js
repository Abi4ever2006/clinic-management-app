const express = require('express');
const router = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');

// Simple rule-based parser — no AI needed
const parseVoiceLocally = (transcript) => {
  const text = transcript.toLowerCase();
  const medicines = [];

  // Split by common separators
  const sentences = text.split(/\.\s*|,\s*(?=and\s)|;\s*|\band\s+also\b|\balso\b/);

  for (const sentence of sentences) {
    if (!sentence.trim()) continue;

    const med = {};

    // Extract medicine name (first capitalized word group)
    const nameMatch = transcript.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    if (nameMatch) med.name = nameMatch[1];
    else med.name = sentence.trim().split(' ')[0];

    // Extract dosage
    const dosageMatch = sentence.match(/(\d+\s*(?:mg|ml|mcg|g|iu|units?))/i);
    med.dosage = dosageMatch ? dosageMatch[1].replace(/\s+/, '') : '';

    // Extract frequency
    if (/four\s+times|4\s+times/i.test(sentence)) {
      med.frequency = '4 times a day'; med.frequencyCount = 4;
    } else if (/three\s+times|thrice|3\s+times/i.test(sentence)) {
      med.frequency = '3 times a day'; med.frequencyCount = 3;
    } else if (/twice|two\s+times|2\s+times/i.test(sentence)) {
      med.frequency = 'Twice a day'; med.frequencyCount = 2;
    } else {
      med.frequency = 'Once a day'; med.frequencyCount = 1;
    }

    // Extract duration
    const daysMatch = sentence.match(/(\d+)\s*days?/i);
    const weeksMatch = sentence.match(/(\d+)\s*weeks?/i);
    if (daysMatch) med.duration = parseInt(daysMatch[1]);
    else if (weeksMatch) med.duration = parseInt(weeksMatch[1]) * 7;
    else med.duration = 1;

    // Extract instructions
    if (/after\s+meal/i.test(sentence)) med.instructions = 'After meals';
    else if (/before\s+meal/i.test(sentence)) med.instructions = 'Before meals';
    else if (/with\s+food/i.test(sentence)) med.instructions = 'With food';
    else if (/at\s+night|night/i.test(sentence)) med.instructions = 'At night';
    else if (/morning/i.test(sentence)) med.instructions = 'In the morning';
    else med.instructions = '';

    if (med.name) medicines.push(med);
  }

  return medicines.length > 0 ? medicines : null;
};

router.post('/parse', verifyJWT, requireRole('doctor'), async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript || transcript.trim().length < 3) {
      return res.status(400).json({ message: 'Transcript is too short.' });
    }

    // Try Gemini first, fall back to local parser
    let medicines = null;
    try {
      const { parseVoicePrescription } = require('../services/geminiService');
      medicines = await parseVoicePrescription(transcript);
    } catch (err) {
      
      medicines = parseVoiceLocally(transcript);
    }

    if (!medicines || medicines.length === 0) {
      return res.status(400).json({ message: 'No medicines detected. Please try again.' });
    }

    res.json({ success: true, transcript, medicines, count: medicines.length });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;