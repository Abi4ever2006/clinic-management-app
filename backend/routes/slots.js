const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../middleware/auth');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const redis = require('../config/redis');

// Generate time slots from working hours
const generateSlots = (startTime, endTime, slotMinutes) => {
  const slots = [];

  const startParts = startTime.split(':');
  const startH = parseInt(startParts[0]);
  const startM = parseInt(startParts[1]);

  const endParts = endTime.split(':');
  const endH = parseInt(endParts[0]);
  const endM = parseInt(endParts[1]);

  let current = (startH * 60) + startM;
  const end = (endH * 60) + endM;

  while (current + slotMinutes <= end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    const period = h < 12 ? 'AM' : 'PM';
    const displayH = h % 12 === 0 ? 12 : h % 12;

    const slot = `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
    slots.push(slot);
    current += slotMinutes;
  }

  return slots;
};

// GET /api/slots?doctorId=&date=YYYY-MM-DD
router.get('/', verifyJWT, async (req, res) => {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId || !date) {
      return res.status(400).json({
        message: 'doctorId and date are required'
      });
    }

    // Check Redis cache first
    const cacheKey = `slots:${doctorId}:${date}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log('✅ Slots served from Redis cache');
        return res.json(cached);
      }
    } catch (redisErr) {
      console.log('Redis read error (continuing without cache):', redisErr.message);
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayName = dateObj.toLocaleDateString('en-US', {
      weekday: 'long'
    });

    const workingDay = doctor.workingHours.find((w) => w.day === dayName);

    if (!workingDay || workingDay.isOff) {
      return res.json({
        slots: [],
        message: 'Doctor is off on this day'
      });
    }

    const allSlots = generateSlots(
      workingDay.startTime,
      workingDay.endTime,
      doctor.slotDurationMinutes
    );

    const booked = await Appointment.find({
      doctor: doctorId,
      date,
      status: { $ne: 'cancelled' },
    }).select('timeSlot');

    const bookedSet = new Set(booked.map((a) => a.timeSlot));
    const availableSlots = allSlots.filter((s) => !bookedSet.has(s));

    const result = {
      slots: availableSlots,
      bookedSlots: [...bookedSet],
    };

    // Save to Redis cache for 2 minutes
    try {
      await redis.set(cacheKey, JSON.stringify(result), { ex: 120 });
      console.log('✅ Slots cached in Redis for 2 minutes');
    } catch (redisErr) {
      console.log('Redis write error (continuing without cache):', redisErr.message);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;