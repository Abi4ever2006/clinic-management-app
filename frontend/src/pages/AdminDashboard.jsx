import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import useAuthStore from '../store/authStore';
import { connectSocket, disconnectSocket } from '../utils/socket';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

const StatusBadge = ({ status }) => {
  const styles = {
    scheduled: 'bg-blue-100 text-blue-800',
    vitals_recorded: 'bg-yellow-100 text-yellow-800',
    in_consultation: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

const VitalsEditor = ({ appointment, onSave }) => {
  const [vitals, setVitals] = useState({
    bloodPressure: appointment.vitals?.bloodPressure || '',
    height: appointment.vitals?.height || '',
    weight: appointment.vitals?.weight || '',
    temperature: appointment.vitals?.temperature || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!vitals.bloodPressure && !vitals.weight) {
      toast.error('Please fill at least Blood Pressure and Weight');
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch(`/api/vitals/${appointment._id}`, vitals);
      onSave(res.data);
      toast.success('Vitals saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save vitals');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
        Record Vitals
      </p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { key: 'bloodPressure', label: 'BP (mmHg)', placeholder: '120/80', type: 'text' },
          { key: 'height', label: 'Height (cm)', placeholder: '170', type: 'number' },
          { key: 'weight', label: 'Weight (kg)', placeholder: '70', type: 'number' },
          { key: 'temperature', label: 'Temp (°F)', placeholder: '98.6', type: 'number' },
        ].map(({ key, label, placeholder, type }) => (
          <div key={key}>
            <label className="text-xs text-gray-500 mb-1 block">{label}</label>
            <input
              type={type}
              value={vitals[key]}
              onChange={(e) => setVitals((v) => ({ ...v, [key]: e.target.value }))}
              placeholder={placeholder}
              className="input text-xs"
            />
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary text-xs py-2 w-full"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Saving...
          </span>
        ) : '✓ Save Vitals & Send to Doctor'}
      </button>
    </div>
  );
};

const AdminDashboard = () => {
  const { user, clearAuth } = useAuthStore();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [prescriptionAlert, setPrescriptionAlert] = useState(null);

  useEffect(() => {
    loadTodayAppointments();
    setupSocket();
    return () => { disconnectSocket(); };
  }, []);

  const loadTodayAppointments = async () => {
    try {
      const res = await api.get('/api/appointments/today');
      setAppointments(res.data);
    } catch {
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const setupSocket = () => {
    const socket = connectSocket({ role: 'admin', userId: user._id });

    socket.on('new_appointment', (appt) => {
      setAppointments((prev) => {
        if (prev.find((a) => a._id === appt._id)) return prev;
        toast.success(`New: ${appt.patient?.name} — Token #${appt.tokenNumber}`);
        return [...prev, appt].sort((a, b) => a.tokenNumber - b.tokenNumber);
      });
    });

    socket.on('appointment_status_updated', (updated) => {
      setAppointments((prev) =>
        prev.map((a) => (a._id === updated._id ? updated : a))
      );
    });

    socket.on('vitals_saved', (updated) => {
      setAppointments((prev) =>
        prev.map((a) => (a._id === updated._id ? updated : a))
      );
    });

    socket.on('prescription_done', ({ patient, pdfUrl }) => {
      toast.success(`Prescription ready for ${patient?.name}!`, { duration: 10000 });
      setPrescriptionAlert({ patient, pdfUrl });
    });
  };

  const onVitalsSaved = (updated) => {
    setAppointments((prev) =>
      prev.map((a) => (a._id === updated._id ? updated : a))
    );
    setExpandedId(null);
  };

  const stats = [
    { label: 'Total', value: appointments.length, color: 'text-blue-600', bg: 'bg-blue-50', icon: '📋' },
    { label: 'Waiting', value: appointments.filter((a) => a.status === 'scheduled').length, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '⏳' },
    { label: 'In Progress', value: appointments.filter((a) => ['vitals_recorded', 'in_consultation'].includes(a.status)).length, color: 'text-purple-600', bg: 'bg-purple-50', icon: '🩺' },
    { label: 'Done', value: appointments.filter((a) => a.status === 'completed').length, color: 'text-green-600', bg: 'bg-green-50', icon: '✅' },
  ];

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-green-600 w-8 h-8 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">🏥</span>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 text-sm">Admin</h1>
              <p className="text-xs text-gray-500">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadTodayAppointments}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded"
            >
              🔄
            </button>
            <button onClick={clearAuth} className="text-sm text-gray-500 hover:text-gray-700">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">

        {/* Prescription Alert */}
        {prescriptionAlert && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div>
              <p className="font-medium text-green-800 text-sm">
                🖨️ Prescription ready for {prescriptionAlert.patient?.name}
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                Ready to print physical copy
              </p>
            </div>
            <div className="flex gap-2">
              <a
                href={prescriptionAlert.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-xs py-1.5 px-3"
              >
                🖨️ Print
              </a>
              <button
                onClick={() => setPrescriptionAlert(null)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(({ label, value, color, bg, icon }) => (
            <div key={label} className={`card text-center py-3 ${bg}`}>
              <p className="text-xl mb-1">{icon}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Queue */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">Live Queue</h2>
            <p className="text-xs text-gray-400">Updates in real time</p>
          </div>

          {loading ? (
            <div className="p-8">
              <LoadingSpinner text="Loading today's queue..." />
            </div>
          ) : appointments.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No appointments today"
              description="Appointments will appear here when patients book online."
            />
          ) : (
            <div className="divide-y divide-gray-50">
              {appointments.map((appt) => (
                <div key={appt._id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="bg-blue-100 text-blue-700 font-bold text-xs w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        #{appt.tokenNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <p className="font-medium text-gray-900 text-sm">
                            {appt.patient?.name}
                          </p>
                          <StatusBadge status={appt.status} />
                        </div>
                        <p className="text-xs text-gray-500">
                          {appt.timeSlot} • Dr. {appt.doctor?.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {appt.patient?.phone} • {appt.reasonForVisit}
                        </p>
                        {appt.vitals?.weight && (
                          <p className="text-xs text-green-600 mt-1">
                            ✅ BP: {appt.vitals.bloodPressure} • {appt.vitals.weight}kg • {appt.vitals.temperature}°F
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {appt.status === 'scheduled' && (
                        <button
                          onClick={() => setExpandedId(expandedId === appt._id ? null : appt._id)}
                          className="btn-primary text-xs py-1.5 px-2"
                        >
                          {expandedId === appt._id ? 'Close' : '+ Vitals'}
                        </button>
                      )}
                      {appt.status === 'vitals_recorded' && (
                        <span className="text-xs text-yellow-600">⏳ Waiting</span>
                      )}
                      {appt.status === 'in_consultation' && (
                        <span className="text-xs text-purple-600">🩺 With doctor</span>
                      )}
                      {appt.status === 'completed' && (
                        <span className="text-xs text-green-600">✅ Done</span>
                      )}
                    </div>
                  </div>

                  {expandedId === appt._id && (
                    <VitalsEditor appointment={appt} onSave={onVitalsSaved} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;