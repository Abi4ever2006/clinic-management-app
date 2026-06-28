import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../utils/api';
import useAuthStore from '../store/authStore';
import { connectSocket, disconnectSocket } from '../utils/socket';
import { requestNotificationPermission, onForegroundMessage } from '../utils/firebase';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

const schema = z.object({
  doctorId: z.string().min(1, 'Please select a doctor'),
  date: z.string().min(1, 'Please select a date'),
  timeSlot: z.string().min(1, 'Please select a time slot'),
  reasonForVisit: z.string().min(3, 'Please enter reason for visit'),
});

const StatusBadge = ({ status }) => {
  const styles = {
    scheduled: 'bg-blue-100 text-blue-800',
    vitals_recorded: 'bg-yellow-100 text-yellow-800',
    in_consultation: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

const PatientDashboard = () => {
  const { user, clearAuth } = useAuthStore();
  const [activeTab, setActiveTab] = useState('book');
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const selectedDoctor = watch('doctorId');
  const selectedDate = watch('date');
  const selectedSlot = watch('timeSlot');

  useEffect(() => {
    loadDoctors();
    loadAppointments();
    setupSocketAndNotifications();
    return () => { disconnectSocket(); };
  }, []);

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      loadSlots(selectedDoctor, selectedDate);
    } else {
      setSlots([]);
    }
  }, [selectedDoctor, selectedDate]);

  const loadDoctors = async () => {
    try {
      const res = await api.get('/api/doctors');
      setDoctors(res.data);
    } catch {
      toast.error('Failed to load doctors');
    } finally {
      setLoadingDoctors(false);
    }
  };

  const loadAppointments = async () => {
    try {
      const res = await api.get('/api/appointments/mine');
      setAppointments(res.data);
    } catch {
      toast.error('Failed to load appointments');
    } finally {
      setLoadingAppointments(false);
    }
  };

  const loadSlots = async (doctorId, date) => {
    setLoadingSlots(true);
    setValue('timeSlot', '');
    setSlots([]);
    try {
      const res = await api.get('/api/slots', { params: { doctorId, date } });
      setSlots(res.data.slots || []);
      if (!res.data.slots?.length) {
        toast('No available slots for this date', { icon: '📅' });
      }
    } catch {
      toast.error('Failed to load slots');
    } finally {
      setLoadingSlots(false);
    }
  };

  const setupSocketAndNotifications = async () => {
    const socket = connectSocket({ role: 'patient', userId: user._id });

    socket.on('appointment_status_updated', (updatedAppt) => {
      setAppointments((prev) =>
        prev.map((a) => a._id === updatedAppt._id ? updatedAppt : a)
      );
      toast(`Status: ${updatedAppt.status.replace(/_/g, ' ')}`, { icon: '📋' });
    });

    socket.on('token_called', ({ patientId }) => {
      if (patientId === user._id) {
        toast('🔔 Your token is being called! Please go to the doctor.', {
          duration: 10000, icon: '🏥',
        });
      }
    });

    socket.on('appointment_reminder', ({ message }) => {
      toast(`⏰ ${message}`, { icon: '🏥', duration: 8000 });
    });

    socket.on('prescription_ready', ({ pdfUrl, doctorName }) => {
      toast.success(`Prescription from Dr. ${doctorName} is ready!`, { duration: 8000 });
    });

    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const fcmToken = await requestNotificationPermission();
          if (fcmToken) {
            await api.patch('/api/auth/fcm-token', { fcmToken });
          }
        }
      }
    } catch { /* FCM optional */ }

    onForegroundMessage?.((payload) => {
      const { title, body } = payload.notification || {};
      if (title) toast(`🔔 ${title}: ${body}`, { duration: 8000 });
    });
  };

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      const res = await api.post('/api/appointments', data);
      setAppointments((prev) => [res.data, ...prev]);
      reset();
      setSlots([]);
      setActiveTab('history');
      toast.success(`Booked! Token #${res.data.tokenNumber}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelAppointment = async (id) => {
    try {
      await api.patch(`/api/appointments/${id}/cancel`);
      setAppointments((prev) =>
        prev.map((a) => a._id === id ? { ...a, status: 'cancelled' } : a)
      );
      toast.success('Appointment cancelled');
    } catch {
      toast.error('Failed to cancel');
    }
  };

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">🏥</span>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 text-sm">{user.name}</h1>
              <p className="text-xs text-gray-500">Patient</p>
            </div>
          </div>
          <button onClick={clearAuth} className="text-sm text-gray-500 hover:text-gray-700">
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
          {[
            { key: 'book', label: '📅 Book' },
            { key: 'history', label: `📋 My Appointments ${appointments.length > 0 ? `(${appointments.length})` : ''}` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Book Tab */}
        {activeTab === 'book' && (
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Book New Appointment
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Doctor */}
              <div>
                <label className="label">Select Doctor</label>
                {loadingDoctors ? (
                  <div className="flex items-center gap-2 py-2">
                    <LoadingSpinner size="sm" text="" />
                    <span className="text-sm text-gray-500">Loading doctors...</span>
                  </div>
                ) : (
                  <select {...register('doctorId')} className="input">
                    <option value="">-- Choose a Doctor --</option>
                    {doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        Dr. {d.name} — {d.specialization}
                      </option>
                    ))}
                  </select>
                )}
                {errors.doctorId && (
                  <p className="text-red-500 text-xs mt-1">{errors.doctorId.message}</p>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="label">Select Date</label>
                <input
                  type="date"
                  min={today}
                  {...register('date')}
                  className="input"
                />
                {errors.date && (
                  <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>
                )}
              </div>

              {/* Time Slots */}
              <div>
                <label className="label">Available Time Slots</label>
                {!selectedDoctor || !selectedDate ? (
                  <p className="text-sm text-gray-400 py-2">
                    Select a doctor and date to see available slots
                  </p>
                ) : loadingSlots ? (
                  <div className="py-3">
                    <LoadingSpinner size="sm" text="Loading available slots..." />
                  </div>
                ) : slots.length === 0 ? (
                  <EmptyState
                    icon="📅"
                    title="No slots available"
                    description="Doctor is off on this day or all slots are booked. Try another date."
                  />
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot) => (
                      <label key={slot} className="cursor-pointer">
                        <input
                          type="radio"
                          value={slot}
                          {...register('timeSlot')}
                          className="sr-only"
                        />
                        <div className={`text-center text-xs py-2 rounded-lg border transition-all ${
                          selectedSlot === slot
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                        }`}>
                          {slot}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {errors.timeSlot && (
                  <p className="text-red-500 text-xs mt-1">{errors.timeSlot.message}</p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="label">Reason for Visit</label>
                <textarea
                  {...register('reasonForVisit')}
                  className="input resize-none"
                  rows={3}
                  placeholder="Describe your symptoms..."
                />
                {errors.reasonForVisit && (
                  <p className="text-red-500 text-xs mt-1">{errors.reasonForVisit.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Booking...
                  </span>
                ) : 'Confirm Appointment'}
              </button>
            </form>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              My Appointments
            </h2>
            {loadingAppointments ? (
              <LoadingSpinner text="Loading your appointments..." />
            ) : appointments.length === 0 ? (
              <EmptyState
                icon="📅"
                title="No appointments yet"
                description="Book your first appointment with one of our doctors."
                action={() => setActiveTab('book')}
                actionLabel="Book Now"
              />
            ) : (
              <div className="space-y-3">
                {appointments.map((appt) => (
                  <div key={appt._id} className="card">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 text-sm">
                            Dr. {appt.doctor?.name}
                          </span>
                          <StatusBadge status={appt.status} />
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                            #{appt.tokenNumber}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {appt.date} • {appt.timeSlot}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {appt.doctor?.specialization}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {appt.reasonForVisit}
                        </p>
                        {appt.prescription?.pdfUrl && (
                          <a
                            href={appt.prescription.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 text-xs hover:underline mt-1 inline-block"
                          >
                            📄 Download Prescription
                          </a>
                        )}
                      </div>
                      {appt.status === 'scheduled' && (
                        <button
                          onClick={() => cancelAppointment(appt._id)}
                          className="text-red-500 text-xs hover:underline ml-2 flex-shrink-0"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;