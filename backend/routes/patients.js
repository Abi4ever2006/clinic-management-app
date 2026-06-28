const express = require('express');
const router = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');

// GET /api/patients/history?phone=9876543210
// Doctor fetches full visit history for a patient by phone number
router.get('/history', verifyJWT, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ message: 'phone is required' });
    }

    // Find the patient
    const patient = await Patient.findOne({ phone });

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Get all their appointments (sorted newest first)
    const appointments = await Appointment.find({ patient: patient._id })
      .populate('doctor', 'name specialization')
      .populate('prescription')
      .sort({ createdAt: -1 });

    res.json({
      patient: {
        name: patient.name,
        age: patient.age,
        phone: patient.phone,
        email: patient.email,
      },
      totalVisits: appointments.length,
      appointments,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;