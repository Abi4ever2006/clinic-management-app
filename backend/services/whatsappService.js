const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const formatPhoneForWhatsApp = (phone) => {
  let cleaned = phone.replace(/\D/g, '');

  // Handle already having country code
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `whatsapp:+${cleaned}`;
  }

  // 10 digit Indian number
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }

  return `whatsapp:+${cleaned}`;
};

// Send prescription PDF link via WhatsApp
const sendPrescriptionWhatsApp = async ({
  to,
  patientName,
  doctorName,
  pdfUrl,
}) => {
  try {
    const formattedTo = formatPhoneForWhatsApp(to);
    console.log('Sending prescription WhatsApp to:', formattedTo);

    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: formattedTo,
      body:
        `🏥 *Clinic Management*\n\n` +
        `Hello ${patientName},\n\n` +
        `Your prescription from Dr. ${doctorName} is ready.\n\n` +
        `📄 Download here:\n${pdfUrl}\n\n` +
        `Get well soon! 💙`,
    });

    console.log('✅ Prescription WhatsApp sent:', message.sid);
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error('❌ Prescription WhatsApp error:', err.message);
    return { success: false, error: err.message };
  }
};

// Send medicine reminder via WhatsApp
const sendMedicineReminder = async ({
  to,
  patientName,
  medicineName,
  dosage,
  frequency,
  instructions,
  customMessage = null,
}) => {
  try {
    const formattedTo = formatPhoneForWhatsApp(to);
    console.log('Sending medicine reminder WhatsApp to:', formattedTo);

    // Use custom AI message if provided, otherwise use default
    const body = customMessage ||
      `💊 *Medicine Reminder*\n\n` +
      `Hello ${patientName},\n\n` +
      `Time to take: *${medicineName}* (${dosage})\n` +
      `Frequency: ${frequency}\n` +
      (instructions ? `Instructions: ${instructions}\n` : '') +
      `\nStay consistent with your medication! 💪`;

    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: formattedTo,
      body,
    });

    console.log('✅ Medicine reminder WhatsApp sent:', message.sid);
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error('❌ Medicine reminder WhatsApp error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendPrescriptionWhatsApp, sendMedicineReminder };