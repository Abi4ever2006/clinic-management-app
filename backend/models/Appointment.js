const mongoose = require('mongoose');

const vitalsSchema = new mongoose.Schema({
  bloodPressure: { type: String, default: null },
  height: { type: Number, default: null },
  weight: { type: Number, default: null },
  temperature: { type: Number, default: null },
  recordedAt: { type: Date, default: null },
});

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    date: { type: String, required: true },
    timeSlot: { type: String, required: true },
    tokenNumber: { type: Number, required: true },
    reasonForVisit: { type: String, required: true },
    status: {
      type: String,
      enum: [
        'scheduled',
        'vitals_recorded',
        'in_consultation',
        'completed',
        'cancelled',
      ],
      default: 'scheduled',
    },
    vitals: { type: vitalsSchema, default: () => ({}) },
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      default: null,
    },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent double booking
appointmentSchema.index(
  { doctor: 1, date: 1, timeSlot: 1 },
  { unique: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);