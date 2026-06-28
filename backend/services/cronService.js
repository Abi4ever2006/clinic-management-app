const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const { admin } = require('../config/firebase');
const { getDueReminders, deleteReminder } = require('./reminderService');
const { sendMedicineReminder } = require('./whatsappService');
const { generateReminderMessage } = require('./geminiService');

const sendFCMNotification = async (fcmToken, title, body) => {
  if (!fcmToken) return;
  try {
    await admin.messaging().send({
      notification: { title, body },
      token: fcmToken,
    });
    console.log('✅ FCM notification sent');
    return true;
  } catch (err) {
    console.error('FCM send error:', err.message);
    return false;
  }
};

const timeSlotToMinutes = (timeSlot) => {
  const [time, period] = timeSlot.split(' ');
  const [hours, minutes] = time.split(':').map(Number);
  let totalHours = hours;
  if (period === 'PM' && hours !== 12) totalHours += 12;
  if (period === 'AM' && hours === 12) totalHours = 0;
  return totalHours * 60 + minutes;
};

const getCurrentMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

const getTodayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const startCronJobs = (io) => {

  // ── Appointment Reminder (every minute) ─────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const today = getTodayString();
      const currentMinutes = getCurrentMinutes();

      const appointments = await Appointment.find({
        date: today,
        status: { $in: ['scheduled', 'vitals_recorded'] },
        reminderSent: false,
      }).populate('patient', 'name phone fcmToken');

      for (const appt of appointments) {
        const apptMinutes = timeSlotToMinutes(appt.timeSlot);
        const diff = apptMinutes - currentMinutes;

        if (diff >= 9 && diff <= 11) {
          console.log(`[Cron] Sending appointment reminder for ${appt.patient?.name}`);

          if (appt.patient?.fcmToken) {
            await sendFCMNotification(
              appt.patient.fcmToken,
              '⏰ Appointment Reminder',
              `Your appointment is in 10 minutes at ${appt.timeSlot}. Please be ready.`
            );
          }

          io.to(`patient_${appt.patient._id}`).emit('appointment_reminder', {
            message: `Your appointment is in 10 minutes at ${appt.timeSlot}. Please be ready.`,
            appointmentId: appt._id,
            timeSlot: appt.timeSlot,
          });

          await Appointment.findByIdAndUpdate(appt._id, { reminderSent: true });
          console.log(`[Cron] Appointment reminder sent and marked for ${appt.patient?.name}`);
        }
      }
    } catch (err) {
      console.error('[Cron] Appointment reminder error:', err.message);
    }
  });

  
  // ── Medicine Reminder (every minute) ────────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const dueReminders = await getDueReminders();
      
      if (dueReminders.length > 0) {
        console.log(`[Cron] Processing ${dueReminders.length} medicine reminder(s)`);
      }
      
      for (const { key, data } of dueReminders) {
        console.log(`[Cron] Medicine reminder: ${data.medicineName} for ${data.patientName}`);
        
        // Generate personalized message using Gemini 
        let customMessage = null;
        try {
          customMessage = await generateReminderMessage({
            patientName: data.patientName,
            medicineName: data.medicineName,
            dosage: data.dosage,
            frequency: data.frequency,
            instructions: data.instructions,
          });
          console.log('[Cron] AI message generated');
        } catch (aiErr) {
          console.log('[Cron] AI message failed, using default:', aiErr.message);
          // Will use default message in sendMedicineReminder
        }
        
        // Send WhatsApp with AI message (or default if AI failed)
        const whatsappResult = await sendMedicineReminder({
          to: data.patientPhone,
          patientName: data.patientName,
          medicineName: data.medicineName,
          dosage: data.dosage,
          frequency: data.frequency,
          instructions: data.instructions,
          customMessage,
        });
        
        if (whatsappResult.success) {
          console.log(`[Cron] ✅ Medicine reminder sent to ${data.patientName}`);
        } else {
          console.log(`[Cron] ⚠️ WhatsApp failed: ${whatsappResult.error}`);
        }
        
        // Always delete key after processing (avoid duplicate sends)
        await deleteReminder(key);
      }
    } catch (err) {
      console.error('[Cron] Medicine reminder error:', err.message);
    }
  });
  
  console.log('⏲️ Cron jobs started (appointment reminders + medicine reminders)');
};

module.exports = { startCronJobs };