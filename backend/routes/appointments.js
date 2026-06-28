const express = require('express');
const router = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const Appointment = require('../models/Appointment');
const redis = require('../config/redis');
const Prescription = require('../models/Prescription');

// POST /api/appointments — book appointment
router.post('/', verifyJWT, requireRole('patient'), async (req, res) => {
  try {
    const { doctorId, date, timeSlot, reasonForVisit } = req.body;
    const patientId = req.user.id;

    const todayCount = await Appointment.countDocuments({
      doctor: doctorId,
      date,
      status: { $ne: 'cancelled' },
    });

    const appointment = await Appointment.create({
      patient: patientId,
      doctor: doctorId,
      date,
      timeSlot,
      reasonForVisit,
      tokenNumber: todayCount + 1,
    });

    // Delete cached slots for this doctor and date
    try {
      const cacheKey = `slots:${doctorId}:${date}`;
      await redis.del(cacheKey);
      console.log('✅ Slot cache invalidated after booking');
    } catch (redisErr) {
      console.log('Redis delete error:', redisErr.message);
    }

    const populated = await Appointment.findById(appointment._id)
      .populate('patient', 'name age phone email')
      .populate('doctor', 'name specialization');

    // Emit real-time event to admin dashboard
    req.io.emit('new_appointment', populated);

    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: 'This time slot is already booked'
      });
    }
    res.status(500).json({ message: err.message });
  }
});

// GET /api/appointments/mine
router.get('/mine', verifyJWT, requireRole('patient'), async (req, res) => {
  try {
    const appointments = await Appointment.find({
      patient: req.user.id
    })
      .populate('doctor', 'name specialization')
      .populate('prescription')
      .sort({ createdAt: -1 });

    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/appointments/today
router.get('/today', verifyJWT, requireRole('admin', 'doctor'), async (req, res) => {
  try {
    const { doctorId } = req.query;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    console.log('=== TODAY ROUTE ===');
    console.log('Server today date:', today);
    console.log('doctorId filter:', doctorId);

    const filter = { date: today };
    if (doctorId) filter.doctor = doctorId;

    console.log('Filter used:', JSON.stringify(filter));

    const appointments = await Appointment.find(filter)
      .populate('patient', 'name age phone email')
      .populate('doctor', 'name specialization')
      .populate('prescription')
      .sort('tokenNumber');

    console.log('Matched appointments:', appointments.length);

    res.json(appointments);
  } catch (err) {
    console.log('=== TODAY ROUTE ERROR ===');
    console.log(err.message);
    console.log(err.stack);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/appointments/:id/cancel
router.patch(
  '/:id/cancel',
  verifyJWT,
  requireRole('patient'),
  async (req, res) => {
    try {
      const appointment = await Appointment.findOneAndUpdate(
        { _id: req.params.id, patient: req.user.id },
        { status: 'cancelled' },
        { new: true }
      );
      if (!appointment) {
        return res.status(404).json({ message: 'Appointment not found' });
      }
      res.json(appointment);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;