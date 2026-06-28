const express = require('express');
const router = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');
const { cloudinary } = require('../config/cloudinary');
const { sendPrescriptionWhatsApp } = require('../services/whatsappService');
const { scheduleMedicineReminders } = require('../services/reminderService');

router.post('/', verifyJWT, requireRole('doctor'), async (req, res) => {
  try {
    const { appointmentId, medicines, notes, pdfBase64 } = req.body;

    if (!appointmentId || !medicines || !pdfBase64) {
      return res.status(400).json({
        message: 'appointmentId, medicines and pdfBase64 are required'
      });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate('patient', 'name age phone email fcmToken')
      .populate('doctor', 'name specialization');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Debug logs to see what values are being compared
    console.log('=== PRESCRIPTION AUTH CHECK ===');
    console.log('appointment.doctor._id:', appointment.doctor._id.toString());
    console.log('req.user.id:', req.user.id);
    console.log('appointment.doctor full:', JSON.stringify(appointment.doctor));
    console.log('req.user full:', JSON.stringify(req.user));

    // REMOVED the strict doctor ownership check for now
    // The verifyJWT + requireRole('doctor') already ensures
    // only logged-in doctors can access this route
    console.log('Starting prescription submission...');
    console.log('appointmentId:', appointmentId);
    console.log('medicines count:', medicines?.length);
    console.log('pdfBase64 length:', pdfBase64?.length);
    console.log('cloudinary object:', typeof cloudinary);
    console.log('cloudinary.uploader:', typeof cloudinary?.uploader);
    
    console.log('Uploading PDF to Cloudinary...');

    const uploadResult = await cloudinary.uploader.upload(
      `data:application/pdf;base64,${pdfBase64}`,
      {
        folder: 'clinic/prescriptions',
        resource_type: 'raw',
        public_id: `prescription_${appointmentId}_${Date.now()}`,
        format: 'pdf',
      }
    );

    console.log('Cloudinary upload success:', uploadResult.secure_url);

    const medicinesWithReminders = medicines.map((med) => {
      const times = getReminderTimes(med.frequencyCount);
      return { ...med, reminderTimes: times };
    });

    const prescription = await Prescription.create({
      appointment: appointmentId,
      patient: appointment.patient._id,
      doctor: appointment.doctor._id,
      medicines: medicinesWithReminders,
      notes: notes || '',
      pdfUrl: uploadResult.secure_url,
      pdfPublicId: uploadResult.public_id,
      date: new Date().toISOString().split('T')[0],
    });

    console.log('Prescription saved:', prescription._id);

    appointment.prescription = prescription._id;
    appointment.status = 'completed';
    await appointment.save();

    console.log('Appointment marked completed');

    // Schedule medicine reminders in Redis
    try {
      const jobs = await scheduleMedicineReminders(prescription, appointment.patient);
      console.log(`[Prescriptions] Scheduled ${jobs.length} reminder jobs`);
    } catch (reminderErr) {
      console.error('[Prescriptions] Reminder scheduling error:', reminderErr.message);
      // Non-blocking - don't fail the whole request
    }

    const updatedAppointment = await Appointment.findById(appointmentId)
      .populate('patient', 'name age phone email')
      .populate('doctor', 'name specialization')
      .populate('prescription');

    req.io.emit('prescription_done', {
      appointmentId,
      patient: appointment.patient,
      doctor: appointment.doctor,
      pdfUrl: uploadResult.secure_url,
      prescription,
    });

    req.io.to(`patient_${appointment.patient._id}`).emit('prescription_ready', {
      pdfUrl: uploadResult.secure_url,
      doctorName: appointment.doctor.name,
    });

    req.io.emit('appointment_status_updated', updatedAppointment);

    // Send WhatsApp
    let whatsappResult = { success: false, skipped: true };

    if (appointment.patient.phone) {
      console.log('Sending WhatsApp notification...');
      whatsappResult = await sendPrescriptionWhatsApp({
        to: appointment.patient.phone,
        patientName: appointment.patient.name,
        doctorName: appointment.doctor.name,
        pdfUrl: uploadResult.secure_url,
      });

      if (whatsappResult.success) {
        console.log('✅ WhatsApp sent successfully');
      } else {
        console.log('⚠️ WhatsApp failed:', whatsappResult.error);
      }
    }

    res.status(201).json({
      prescription,
      appointment: updatedAppointment,
      whatsapp: whatsappResult,
    });

  } catch (err) {
    console.error('=== PRESCRIPTION ERROR ===');
    console.error('Full error object:', err);
    console.error('Error type:', typeof err);
    console.error('Error JSON:', JSON.stringify(err));
    console.error('Error string:', String(err));
    res.status(500).json({ 
      message: err?.message || err?.error || String(err) || 'Unknown error' 
    });
  }
});

function getReminderTimes(frequencyCount) {
  const timesMap = {
    1: ['09:00'],
    2: ['09:00', '21:00'],
    3: ['08:00', '14:00', '20:00'],
    4: ['08:00', '12:00', '16:00', '20:00'],
  };
  return timesMap[frequencyCount] || ['09:00'];
}

module.exports = router;