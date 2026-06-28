require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Doctor = require('../models/Doctor');
const Admin = require('../models/Admin');

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const DOCTORS = [
    {
        firebaseUid: '4Nzm5g1uMvVLOSLbkAWVMufr0lx2',
        name: ' Vetri',
        specialization: 'General Physician',
        email: 'doctor1@clinic.com',
        phone: '9876543210',
        slotDurationMinutes: 15,
        workingHours: [
            { day: 'Monday', startTime: '09:00', endTime: '14:00' },
            { day: 'Tuesday', startTime: '09:00', endTime: '14:00' },
            { day: 'Wednesday', startTime: '09:00', endTime: '14:00' },
            { day: 'Thursday', startTime: '09:00', endTime: '14:00' },
            { day: 'Friday', startTime: '09:00', endTime: '14:00' },
            { day: 'Saturday', startTime: '10:00', endTime: '13:00' },
            { day: 'Sunday', startTime: '00:00', endTime: '00:00', isOff: true },
        ],
    },
    {
        firebaseUid: 'rDV8x95MumWwHFg6II1XLBdK9Yo2',
        name: ' Maaran',
        specialization: 'Pediatrician',
        email: 'doctor2@clinic.com',
        phone: '9876543211',
        slotDurationMinutes: 20,
        workingHours: [
            { day: 'Monday', startTime: '16:00', endTime: '21:00' },
            { day: 'Tuesday', startTime: '16:00', endTime: '21:00' },
            { day: 'Wednesday', startTime: '16:00', endTime: '21:00' },
            { day: 'Thursday', startTime: '16:00', endTime: '21:00' },
            { day: 'Friday', startTime: '16:00', endTime: '21:00' },
            { day: 'Saturday', startTime: '10:00', endTime: '13:00' },
            { day: 'Sunday', startTime: '00:00', endTime: '00:00', isOff: true },
        ],
    },
];

const ADMIN = {
    firebaseUid: '9Pf6iCJaKSYk3chmfXbs9IFaDdH3',
    name: 'Reception Admin',
    email: 'admin@clinic.com'
};

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        await Doctor.deleteMany({});
        await Admin.deleteMany({});

        await Doctor.insertMany(DOCTORS);
        

        await Admin.create(ADMIN);
        
        process.exit(0);
    } catch (err) {
        console.error('Seed error:', err);
        process.exit(1);
    }
};

seed();