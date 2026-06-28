const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { verifyFirebaseToken, verifyJWT } = require('../middleware/auth');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Admin = require('../models/Admin');

const MODEL_MAP = {
  patient: Patient,
  doctor: Doctor,
  admin: Admin,
};

// Login route
router.post('/login', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid, email } = req.firebaseUser;
    const role = req.body.role;

    if (!['patient', 'doctor', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const Model = MODEL_MAP[role];
    const user = await Model.findOne({ firebaseUid: uid });

    if (!user) {
      return res.status(404).json({ message: 'User not registered' });
    }

    const token = jwt.sign(
      { id: user._id, role, email, firebaseUid: uid },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { ...user.toObject(), role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Register route
router.post('/register', verifyFirebaseToken, async (req, res) => {
  try {
    const { uid, email } = req.firebaseUser;
    const { name, age, phone } = req.body;

    const existing = await Patient.findOne({ firebaseUid: uid });
    if (existing) {
      return res.status(409).json({ message: 'Already registered' });
    }

    const patient = await Patient.create({
      firebaseUid: uid,
      name,
      age,
      phone,
      email,
    });

    const token = jwt.sign(
      { id: patient._id, role: 'patient', email, firebaseUid: uid },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { ...patient.toObject(), role: 'patient' },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Save FCM token route
router.patch('/fcm-token', verifyJWT, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    await Patient.findByIdAndUpdate(
      req.user.id,
      { fcmToken },
      { new: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login-direct', async (req, res) => {
  try {
    const { email, role } = req.body;
    console.log('login-direct called with:', email, role);

    if (!['patient', 'doctor', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const Model = MODEL_MAP[role];
    const allUsers = await Model.find({}, 'email name');
    console.log('All users found:', JSON.stringify(allUsers));
    console.log('Searching for email:', email);

    const user = await Model.findOne({ email });
    console.log('User found:', user);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = jwt.sign(
      { id: user._id, role, email, firebaseUid: user.firebaseUid },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { ...user.toObject(), role } });
  } catch (err) {
    console.log('Error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;