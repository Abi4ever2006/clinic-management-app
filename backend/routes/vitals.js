const express = require('express');
const router = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const Appointment = require('../models/Appointment');

// PATCH /api/vitals/:appointmentId
// Admin records patient vitals
router.patch('/:appointmentId', verifyJWT, requireRole('admin'), async (req, res) => {
    console.log('User hitting vitals:', req.user); 
    try {
        const { bloodPressure, height, weight, temperature } = req.body;
        
        const appointment = await Appointment.findByIdAndUpdate(
    
            req.params.appointmentId,
            {
                vitals: {
                    bloodPressure,
                    height,
                    weight,
                    temperature,
                    recordedAt: new Date(),
                },
                status: 'vitals_recorded',
            },
            { new: true }
        )
          .populate('patient', 'name age phone email')
          .populate('doctor', 'name specialization');

          if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        req.io
        .to(`doctor_${appointment.doctor._id}`)
        .emit('vitals_updated', appointment);        
        // Emit to admin room for queue update
        req.io.emit('vitals_saved', appointment);
        res.json(appointment);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;