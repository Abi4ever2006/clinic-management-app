const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
    {
        firebaseUid: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        role: { type: String, default: 'admin' },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);