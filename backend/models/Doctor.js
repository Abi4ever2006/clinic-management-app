const mongoose = require('mongoose');

const workingHoursSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['Monday','Tuesday','Wednesday',
           'Thursday','Friday','Saturday','Sunday'],
  },
  startTime: String,
  endTime: String,
  isOff: { type: Boolean, default: false },
});

const doctorSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    specialization: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true },
    slotDurationMinutes: { type: Number, default: 15 }, // ← make sure this exists
    workingHours: [workingHoursSchema],
    role: { type: String, default: 'doctor' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);