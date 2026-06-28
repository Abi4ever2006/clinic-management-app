const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../middleware/auth');
const Doctor = require('../models/Doctor');

router.get('/', verifyJWT, async (req, res) => {
    try {
        const doctors = await Doctor.find().select('-firebaseUid');
        res.json(doctors);
    } catch (err) {        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/:id', verifyJWT, async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id).select('-firebaseUid');
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }
        res.json(doctor);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;