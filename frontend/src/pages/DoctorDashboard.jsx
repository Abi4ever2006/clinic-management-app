import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import useAuthStore from '../store/authStore';
import { connectSocket, disconnectSocket } from '../utils/socket';
import PrescriptionForm from '../components/PrescriptionForm';
import PrescriptionPreview from '../components/PrescriptionPreview';
import { generatePrescriptionPDFBase64, downloadPrescriptionPDF } from '../utils/pdfGenerator';
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
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${styles[status] || styles.scheduled}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};

const VitalsCard = ({ vitals }) => {
  const items = [
    { label: 'Blood Pressure', value: vitals?.bloodPressure, unit: 'mmHg' },
    { label: 'Height', value: vitals?.height, unit: 'cm' },
    { label: 'Weight', value: vitals?.weight, unit: 'kg' },
    { label: 'Temperature', value: vitals?.temperature, unit: '°F' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
      {items.map(({ label, value, unit }) => (
        <div key={label} className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="font-bold text-blue-700">
            {value ? `${value} ${unit}` : (
              <span className="text-gray-400 font-normal text-xs">Pending</span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
};

// ── Visit History Component ───────────────────────────────────
// ── Visit History Component ───────────────────────────────────
const VisitHistory = ({ history, currentAppointmentId }) => {
  if (!history || history.totalVisits <= 1) {
    return null; // First-time patient — don't show history
  }

  // Filter out the current appointment from history
  const pastAppointments = history.appointments.filter(
    (a) => a._id !== currentAppointmentId
  );

  if (pastAppointments.length === 0) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">
          📋 Visit History
        </h3>
        <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium">
          {pastAppointments.length} previous visit{pastAppointments.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {pastAppointments.map((appt) => (
          <div key={appt._id} className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-900">
                {appt.date}
              </p>
              <StatusBadge status={appt.status} />
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Dr. {appt.doctor?.name} — {appt.doctor?.specialization}
            </p>
            <p className="text-xs text-gray-600 mb-2">
              <span className="text-gray-400">Reason:</span> {appt.reasonForVisit}
            </p>

            {/* Past Vitals */}
            {appt.vitals?.weight && (
              <div className="flex flex-wrap gap-2 mb-2">
                {appt.vitals.bloodPressure && (
                  <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">
                    BP: {appt.vitals.bloodPressure}
                  </span>
                )}
                {appt.vitals.weight && (
                  <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">
                    Weight: {appt.vitals.weight}kg
                  </span>
                )}
                {appt.vitals.temperature && (
                  <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">
                    Temp: {appt.vitals.temperature}°F
                  </span>
                )}
              </div>
            )}

            {/* Past Prescription (FIXED: Added the missing <a> opening tag here) */}
            {appt.prescription?.pdfUrl && (
              <a
                href={appt.prescription.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 text-xs hover:underline inline-flex items-center gap-1"
              >
                📄 View Prescription PDF
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const DoctorDashboard = () => {
  const { user, clearAuth } = useAuthStore();
  const [todayQueue, setTodayQueue] = useState([]);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [submittingPrescription, setSubmittingPrescription] = useState(false);

  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [pdfBase64, setPdfBase64] = useState(null);
  const [submittingFinal, setSubmittingFinal] = useState(false);

  useEffect(() => {
    loadTodayQueue();
    setupSocket();
    return () => { disconnectSocket(); };
  }, []);

  const loadTodayQueue = async () => {
    try {
      const res = await api.get('/api/appointments/today', {
        params: { doctorId: user._id }
      });
      setTodayQueue(res.data);
    } catch (err) {
      toast.error('Failed to load today\'s queue');
    } finally {
      setLoading(false);
    }
  };

  const setupSocket = () => {
    const socket = connectSocket({
      role: 'doctor',
      userId: user._id,
      doctorId: user._id,
    });

    socket.on('vitals_updated', (updatedAppt) => {
      setTodayQueue((prev) =>
        prev.map((a) => (a._id === updatedAppt._id ? updatedAppt : a))
      );
      setCurrentPatient((prev) =>
        prev && prev._id === updatedAppt._id ? updatedAppt : prev
      );
      toast.success(`Vitals updated for ${updatedAppt.patient?.name}`, {
        icon: '🩺',
      });
    });

    socket.on('new_appointment', (appt) => {
      if (appt.doctor?._id === user._id || appt.doctor === user._id) {
        setTodayQueue((prev) => {
          const exists = prev.find((a) => a._id === appt._id);
          if (exists) return prev;
          return [...prev, appt].sort((a, b) => a.tokenNumber - b.tokenNumber);
        });
      }
    });

    socket.on('appointment_status_updated', (updated) => {
      setTodayQueue((prev) =>
        prev.map((a) => (a._id === updated._id ? updated : a))
      );
      setCurrentPatient((prev) =>
        prev && prev._id === updated._id ? updated : prev
      );
    });
  };

  // Fetch visit history when a patient is selected
  const loadPatientHistory = async (phone) => {
    setLoadingHistory(true);
    setPatientHistory(null);
    try {
      const res = await api.get('/api/patients/history', {
        params: { phone }
      });
      setPatientHistory(res.data);
    } catch (err) {
      // 404 means first-time patient - that's fine, not an error
      if (err.response?.status !== 404) {
        toast.error('Failed to load patient history');
      }
      setPatientHistory(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  const selectPatient = (appointment) => {
    setCurrentPatient(appointment);
    if (appointment.patient?.phone) {
      loadPatientHistory(appointment.patient.phone);
    }
  };

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const stats = {
    total: todayQueue.length,
    waiting: todayQueue.filter((a) =>
      ['scheduled', 'vitals_recorded'].includes(a.status)
    ).length,
  };

  const handlePrescriptionPreview = (formData) => {
    setSubmittingPrescription(true);

    //PDF generation will be done soon and for now it's just a preview
    setPreviewData(formData);

    setTimeout(() => {
        setSubmittingPrescription(false);
    }, 300);
  };

  const resetPrescriptionForm = () => {
    setShowPrescriptionForm(false);
    setPreviewData(null);
  };

  const handleDownloadPDF = async () => {
    setGeneratingPDF(true);
    try {
      const filename = `prescription_${currentPatient.patient?.name?.replace(/\s+/g, '_')}_${currentPatient.date}.pdf`;
      await downloadPrescriptionPDF('prescription-preview', filename);
      toast.success('PDF downloaded successfully! 📄');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleGeneratePDFBase64 = async () => {
    setGeneratingPDF(true);
    try {
      const base64 = await generatePrescriptionPDFBase64('prescription-preview');
      setPdfBase64(base64);
      toast.success('PDF generated and ready! ✅');
      
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleSubmitPrescription = async () => {
    if (!previewData || !currentPatient) return;
    
    setSubmittingFinal(true);
    try {
      toast.loading('Generating PDF...', { id: 'pdf-gen' });
      const pdfBase64 = await generatePrescriptionPDFBase64('prescription-preview');
      toast.dismiss('pdf-gen');
      
      toast.loading('Uploading prescription...', { id: 'pdf-upload' });
      const res = await api.post('/api/prescriptions', {
        appointmentId: currentPatient._id,
        medicines: previewData.medicines,
        notes: previewData.notes || '',
        pdfBase64,
      });
      toast.dismiss('pdf-upload');
      
      toast.success('Prescription submitted successfully! ✅');
      
      // Show WhatsApp delivery status
      if (res.data.whatsapp?.success) {
        toast.success('📱 WhatsApp sent to patient!', { duration: 5000 });
      } else if (!res.data.whatsapp?.skipped) {
        toast('⚠️ WhatsApp delivery failed - patient can still download via app', {
          icon: '⚠️',
          duration: 6000,
        });
      }
      
      const updatedAppt = res.data.appointment;
      setCurrentPatient(updatedAppt);
      setTodayQueue((prev) =>
        prev.map((a) => (a._id === updatedAppt._id ? updatedAppt : a))
    );

    resetPrescriptionForm();
    setPdfBase64(null);
  
  } catch (err) {
    toast.dismiss('pdf-gen');
    toast.dismiss('pdf-upload');
    console.error('Submission error:', err);
    toast.error(err.response?.data?.message || 'Failed to submit prescription');
  } finally {
    setSubmittingFinal(false);
  }
};

  return (
  <div className="min-h-screen bg-gray-50">
    {/* Header */}
    <header className="bg-white shadow-sm border-b sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-purple-600 w-8 h-8 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm">🩺</span>
          </div>
          <div>
            <h1 className="font-semibold text-gray-900 text-sm">
              Dr. {user.name}
            </h1>
            <p className="text-xs text-gray-500">{user.specialization}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-gray-400">{today}</span>
          <button onClick={clearAuth} className="text-sm text-gray-500 hover:text-gray-700">
            Logout
          </button>
        </div>
      </div>
    </header>

    {/* Mobile: Stack layout, Desktop: Side by side */}
    <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col lg:flex-row gap-4">

      {/* Sidebar — collapsible on mobile */}
      <div className="lg:w-72 flex-shrink-0">
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">
                Today's Queue
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.waiting} waiting • {stats.total} total
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-6">
              <LoadingSpinner size="sm" text="Loading queue..." />
            </div>
          ) : todayQueue.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No appointments today"
              description="Patient appointments will appear here."
            />
          ) : (
            <div className="divide-y divide-gray-50 max-h-96 lg:max-h-[600px] overflow-y-auto">
              {todayQueue.map((appt) => (
                <button
                  key={appt._id}
                  onClick={() => selectPatient(appt)}
                  className={`w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors ${
                    currentPatient?._id === appt._id
                      ? 'bg-purple-50 border-l-4 border-purple-600'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center">
                        {appt.tokenNumber}
                      </span>
                      <span className="font-medium text-gray-900 text-sm">
                        {appt.patient?.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pl-8">
                    <p className="text-xs text-gray-500">{appt.timeSlot}</p>
                    <StatusBadge status={appt.status} />
                  </div>
                  {appt.vitals?.weight && (
                    <p className="text-xs text-green-600 mt-1 pl-8">✅ Vitals ready</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {!currentPatient ? (
          <EmptyState
            icon="👈"
            title="Select a patient from the queue"
            description="Their profile, vitals, history and prescription form will appear here."
          />
        ) : (
          <>
            {/* Patient Info Card */}
            <div className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold text-gray-900">
                      {currentPatient.patient?.name}
                    </h2>
                    <StatusBadge status={currentPatient.status} />
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                      Token #{currentPatient.tokenNumber}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    📞 {currentPatient.patient?.phone} • 🎂 {currentPatient.patient?.age} yrs
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    <span className="text-gray-400">Reason:</span> {currentPatient.reasonForVisit}
                  </p>
                </div>
              </div>

              {/* Vitals */}
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Vitals
                </p>
                {currentPatient.vitals?.weight ? (
                  <VitalsCard vitals={currentPatient.vitals} />
                ) : (
                  <p className="text-sm text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
                    ⏳ Waiting for admin to record vitals
                  </p>
                )}
              </div>
            </div>

            {/* Visit History */}
            {loadingHistory ? (
              <div className="card">
                <LoadingSpinner size="sm" text="Loading patient history..." />
              </div>
            ) : (
              <VisitHistory
                history={patientHistory}
                currentAppointmentId={currentPatient._id}
              />
            )}

            {/* Prescription Section */}
            {currentPatient.status === 'completed' ? (
              <div className="card text-center py-6">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-medium text-gray-900">Prescription Submitted</p>
                {currentPatient.prescription?.pdfUrl && (
                  <a
                    href={currentPatient.prescription.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 text-sm hover:underline mt-2 inline-block"
                  >
                    📄 View Prescription PDF
                  </a>
                )}
              </div>
            ) : currentPatient.status === 'cancelled' ? (
              <div className="card text-center py-6">
                <p className="text-2xl mb-2">❌</p>
                <p className="font-medium text-gray-500">Appointment Cancelled</p>
              </div>
            ) : !showPrescriptionForm ? (
              <div className="card text-center py-6">
                <p className="text-gray-600 mb-4">
                  {currentPatient.vitals?.weight
                    ? 'Vitals recorded. Ready to write prescription.'
                    : 'Waiting for vitals before writing prescription.'}
                </p>
                <button
                  onClick={() => setShowPrescriptionForm(true)}
                  disabled={!currentPatient.vitals?.weight}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✍️ Write Prescription
                </button>
              </div>
            ) : !previewData ? (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Write Prescription</h3>
                  <button
                    onClick={resetPrescriptionForm}
                    className="text-gray-400 hover:text-gray-600 text-sm"
                  >
                    ✕ Cancel
                  </button>
                </div>
                <PrescriptionForm
                  onSubmit={handlePrescriptionPreview}
                  submitting={submittingPrescription}
                />
              </div>
            ) : (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Preview & Submit</h3>
                  <button
                    onClick={resetPrescriptionForm}
                    className="text-gray-400 hover:text-gray-600 text-sm"
                  >
                    ✕ Cancel
                  </button>
                </div>
                <div id="prescription-preview">
                  <PrescriptionPreview
                    prescription={{ medicines: previewData.medicines, notes: previewData.notes }}
                    patient={currentPatient.patient}
                    doctor={{ name: user.name, specialization: user.specialization }}
                    date={currentPatient.date}
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleSubmitPrescription}
                    disabled={submittingFinal}
                    className="btn-primary flex-1"
                  >
                    {submittingFinal ? 'Submitting...' : '✅ Submit Prescription'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  </div>
);
};

export default DoctorDashboard;