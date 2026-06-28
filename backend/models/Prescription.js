const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    frequencyCount: { type: Number, required: true },
    duration: { type: String, required: true },
    instructions: { type: String, default: '' },
    reminderTimes: [{ type: String }],
});

const prescriptionSchema = new mongoose.Schema(
    {
        appointment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment',
            required: true,
            unique: true,
        },
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient',
            required: true,
        }, // <--- FIXED: Added the comma here
        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Doctor',
            required: true,
        },
        medicines: [medicationSchema],
        notes: { type: String, default: '' },
        pdfUrl: { type: String, default: null },
        pdfPublicId: { type: String, default: null },
        scannedImageUrl: { type: String, default: null },
        date: { type: String, required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Prescription', prescriptionSchema);