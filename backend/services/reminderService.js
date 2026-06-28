const redis = require('../config/redis');

// Time slots for each frequency count
const REMINDER_TIMES = {
  1: ['09:00'],
  2: ['09:00', '21:00'],
  3: ['08:00', '14:00', '20:00'],
  4: ['08:00', '12:00', '16:00', '20:00'],
  5: ['07:00', '10:00', '13:00', '16:00', '19:00'],
  6: ['07:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
};

// Add days to a date string (YYYY-MM-DD)
const addDays = (dateStr, days) => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Schedule all reminder jobs for a prescription
const scheduleMedicineReminders = async (prescription, patient) => {
  const jobs = [];

  for (const medicine of prescription.medicines) {
    const frequencyCount = medicine.frequencyCount || 1;
    const duration = medicine.duration || 1;
    const times = REMINDER_TIMES[frequencyCount] || REMINDER_TIMES[1];
    const startDate = prescription.date;

    for (let day = 0; day < duration; day++) {
      const reminderDate = addDays(startDate, day);

      for (const time of times) {
        // Create unique Redis key for this reminder
        const safeKey = `reminder:${prescription._id}:${medicine.name.replace(/\s+/g, '_')}:${reminderDate}:${time.replace(':', '')}`;

        const reminderData = {
          prescriptionId: prescription._id.toString(),
          patientPhone: patient.phone,
          patientName: patient.name,
          medicineName: medicine.name,
          dosage: medicine.dosage,
          frequency: medicine.frequency,
          instructions: medicine.instructions || '',
          date: reminderDate,
          time: time,
        };

        // TTL: number of seconds until this reminder expires
        // Set it to expire 1 day after the last reminder
        const expiryDays = duration - day + 1;
        const expirySeconds = expiryDays * 24 * 60 * 60;

        try {
          await redis.set(safeKey, JSON.stringify(reminderData), {
            ex: expirySeconds,
          });
          jobs.push({ key: safeKey, date: reminderDate, time });
          console.log(`[Reminder] Scheduled: ${safeKey}`);
        } catch (redisErr) {
          console.error('[Reminder] Redis set error:', redisErr.message);
        }
      }
    }
  }

  console.log(`[Reminder] Total jobs scheduled: ${jobs.length}`);
  return jobs;
};

// Check Redis for reminders due right now
const getDueReminders = async () => {
  const now = new Date();
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentTime = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  const pattern = `reminder:*:${currentDate}:${currentTime}`;
  console.log(`[Reminder] Checking pattern: ${pattern}`);

  try {
    const keys = await redis.keys(pattern);
    console.log(`[Reminder] Found ${keys.length} due reminders`);

    const reminders = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        reminders.push({ key, data: parsed });
      }
    }

    return reminders;
  } catch (err) {
    console.error('[Reminder] Redis keys error:', err.message);
    return [];
  }
};

// Delete a reminder key after sending
const deleteReminder = async (key) => {
  try {
    await redis.del(key);
    console.log(`[Reminder] Deleted key: ${key}`);
  } catch (err) {
    console.error('[Reminder] Redis delete error:', err.message);
  }
};

const scheduleTestReminder = async (patientPhone, patientName) => {
  const now = new Date();
  const testMinutes = now.getMinutes() + 2;
  const testHour = testMinutes >= 60
    ? now.getHours() + 1
    : now.getHours();
  const adjustedMinutes = testMinutes >= 60
    ? testMinutes - 60
    : testMinutes;

  const testDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const testTime = `${String(testHour).padStart(2, '0')}${String(adjustedMinutes).padStart(2, '0')}`;

  const key = `reminder:test:Paracetamol:${testDate}:${testTime}`;

  const data = {
    prescriptionId: 'test123',
    patientPhone,
    patientName,
    medicineName: 'Paracetamol',
    dosage: '500mg',
    frequency: '3 times a day',
    instructions: 'After meals',
    date: testDate,
    time: `${String(testHour).padStart(2, '0')}:${String(adjustedMinutes).padStart(2, '0')}`,
  };

  await redis.set(key, JSON.stringify(data), { ex: 300 }); // expires in 5 min
  console.log(`[Test] Scheduled test reminder at ${testDate} ${testTime}`);
  return key;
};

module.exports = {
  scheduleMedicineReminders,
  getDueReminders,
  deleteReminder,
  scheduleTestReminder,
};