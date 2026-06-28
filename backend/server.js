require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const initFirebase = require('./config/firebase');
const { startCronJobs } = require('./services/cronService');

// Route imports
const authRoutes = require('./routes/auth');
const doctorRoutes = require('./routes/doctors');
const slotRoutes = require('./routes/slots');
const appointmentRoutes = require('./routes/appointments');
const vitalsRoutes = require('./routes/vitals');
const patientRoutes = require('/routes/patients');
const prescriptionRoutes = require('./routes/prescriptions');
const scanRoutes = require('./routes/scan');
const voiceRoutes = require('./routes/voice');
const webhookRoutes = require('./routes/webhook');

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
  process.env.VERCEL_URL,
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Helmet with relaxed CSP for production
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", 'wss:', 'ws:', ...allowedOrigins],
      },
    },
  })
);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Thunder Client)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json({limit: '20mb'}));
app.use(express.urlencoded({ extended: true, limit: '20mb'}));

// Attach io to every request
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/webhook', webhookRoutes);

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

// Socket.io handlers
io.on('connection', (socket) => {
  socket.on('join_room', ({ role, userId, doctorId }) => {
    if (role === 'admin') socket.join('admin_room');
    else if (role === 'doctor') socket.join(`doctor_${doctorId || userId}`);
    else if (role === 'patient') socket.join(`patient_${userId}`);
  });

  socket.on('call_next_token', ({ appointmentId, patientId }) => {
    io.emit('token_called', { appointmentId, patientId });
  });

  socket.on('disconnect', () => {});
});

// Initialize
connectDB();
initFirebase();
startCronJobs(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('🏥 Clinic server running on port ${PORT}');
});

