const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Parse voice transcript into structured medicine data
const parseVoicePrescription = async (transcript) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `You are a medical assistant helping a doctor fill a prescription form.

The doctor has spoken this prescription text:
"${transcript}"

Extract all medicines mentioned and return ONLY a valid JSON array.
No markdown, no explanation, just the JSON array.

Format:
[
  {
    "name": "Medicine Name",
    "dosage": "500mg",
    "frequency": "3 times a day",
    "frequencyCount": 3,
    "duration": 5,
    "instructions": "after meals"
  }
]

Rules for extraction:
- "once daily" or "once a day" = frequencyCount: 1
- "twice daily" or "two times a day" = frequencyCount: 2  
- "thrice" or "three times" = frequencyCount: 3
- "four times" = frequencyCount: 4
- Duration: extract number of days ("5 days" = 5, "1 week" = 7, "2 weeks" = 14)
- Dosage: include unit ("500mg", "10ml", "1 tablet")
- If doctor says multiple medicines, extract each one separately
- frequencyCount and duration must be NUMBERS not strings
- If any field unclear, use sensible defaults`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    console.log('Gemini voice parse response:', text);

    const cleaned = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const medicines = JSON.parse(cleaned);

    const sanitized = medicines.map((med) => ({
      name: med.name || '',
      dosage: med.dosage || '',
      frequency: med.frequency || 'Once a day',
      frequencyCount: Number(med.frequencyCount) || 1,
      duration: Number(med.duration) || 1,
      instructions: med.instructions || '',
    }));

    console.log('Parsed medicines from voice:', sanitized);
    return sanitized;

  } catch (err) {
    console.error('Voice parse error:', err.message);
    throw new Error(`Failed to parse voice: ${err.message}`);
  }
};

// Existing functions remain the same
const scanPrescriptionImage = async (imageUrl) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    const prompt = `You are a medical assistant analyzing a prescription image.
Extract all medicine details from this prescription image.
Return ONLY a valid JSON array with no markdown:
[
  {
    "name": "Medicine Name",
    "dosage": "500mg",
    "frequency": "3 times a day",
    "frequencyCount": 3,
    "duration": 5,
    "instructions": "After meals"
  }
]`;

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { data: base64, mimeType } },
    ]);

    const text = result.response.text();
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const medicines = JSON.parse(cleaned);

    return medicines.map((med) => ({
      name: med.name || '',
      dosage: med.dosage || '',
      frequency: med.frequency || 'Once a day',
      frequencyCount: Number(med.frequencyCount) || 1,
      duration: Number(med.duration) || 1,
      instructions: med.instructions || '',
    }));

  } catch (err) {
    console.error('Gemini scan error:', err.message);
    throw new Error(`Failed to scan prescription: ${err.message}`);
  }
};

const generateReminderMessage = async ({
  patientName,
  medicineName,
  dosage,
  frequency,
  instructions,
}) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `Write a short friendly WhatsApp reminder (max 80 words):
Patient: ${patientName}
Medicine: ${medicineName} (${dosage})
Frequency: ${frequency}
Instructions: ${instructions || 'none'}
Return ONLY the message text.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();

  } catch (err) {
    console.error('Gemini reminder error:', err.message);
    return `💊 Reminder for ${patientName}: Time to take ${medicineName} (${dosage}). ${instructions || ''} Stay consistent!`;
  }
};

module.exports = {
  parseVoicePrescription,
  scanPrescriptionImage,
  generateReminderMessage,
};