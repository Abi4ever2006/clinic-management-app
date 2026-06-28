const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema(
    {
        firebaseUid: { type: String, required: true, unique: true },
        name: { type: String, required: true, trim: true },
        age: { type: Number, required: true },
        phone: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, trim: true },
        fcmToken: { type: String, default: null },
        role: { type: String, default: 'patient' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Patient', patientSchema);