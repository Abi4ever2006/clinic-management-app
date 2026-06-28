import React, { useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '../utils/api';
import VoiceDictation from './VoiceDictation';

const medicineSchema = z.object({
  name: z.string().min(1, 'Medicine name required'),
  dosage: z.string().min(1, 'Dosage required'),
  frequency: z.string().min(1, 'Frequency required'),
  frequencyCount: z.number({ coerce: true }).min(1).max(6),
  duration: z.number({ coerce: true }).min(1),
  instructions: z.string().optional(),
});

const prescriptionSchema = z.object({
  medicines: z.array(medicineSchema).min(1, 'Add at least one medicine'),
  notes: z.string().optional(),
});

const FREQUENCY_OPTIONS = [
  { label: 'Once a day', count: 1 },
  { label: 'Twice a day', count: 2 },
  { label: '3 times a day', count: 3 },
  { label: '4 times a day', count: 4 },
];

const emptyMedicine = {
  name: '',
  dosage: '',
  frequency: '',
  frequencyCount: 1,
  duration: 1,
  instructions: '',
};

const PrescriptionForm = ({ onSubmit, submitting }) => {
  const [scanning, setScanning] = useState(false);
  const [scannedImageUrl, setScannedImageUrl] = useState(null);
  const [inputMode, setInputMode] = useState('manual'); // 'manual', 'voice', 'scan'
  const fileInputRef = useRef(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      medicines: [{ ...emptyMedicine }],
      notes: '',
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'medicines',
  });

  const watchedMedicines = watch('medicines');

  const handleFrequencyChange = (index, value) => {
    setValue(`medicines.${index}.frequency`, value);
    const option = FREQUENCY_OPTIONS.find((o) => o.label === value);
    if (option) {
      setValue(`medicines.${index}.frequencyCount`, option.count);
    }
  };

  // Called when voice dictation extracts medicines
  const handleVoiceMedicines = (medicines) => {
    const existing = watchedMedicines.filter(m => m.name.trim() !== '');
    if (existing.length > 0) {
      // Append to existing medicines
      medicines.forEach(med => append(med));
    } else {
      // First time — replace the empty default row
      replace(medicines);
    }
    setInputMode('manual');
    toast.success(`Added ${medicines.length} medicine(s)! Review and edit if needed.`, {
      duration: 4000,
    });
  };
  
  // Handle prescription image scan
  const handleScanImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setScanning(true);
    toast.loading('Analyzing image with AI...', { id: 'scan' });

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await api.post('/api/scan/prescription', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      toast.dismiss('scan');

      if (res.data.medicines && res.data.medicines.length > 0) {
        replace(res.data.medicines);
        setScannedImageUrl(res.data.imageUrl);
        setInputMode('manual');
        toast.success(`✅ Scanned ${res.data.count} medicine(s)!`);
      } else {
        toast.error('No medicines detected. Please fill manually.');
      }
    } catch (err) {
      toast.dismiss('scan');
      toast.error(err.response?.data?.message || 'Scan failed');
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

      {/* Input Mode Selector */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        {[
          { key: 'manual', label: '✏️ Manual', desc: 'Type manually' },
          { key: 'voice', label: '🎤 Voice', desc: 'Speak prescription' },
          { key: 'scan', label: '📸 Scan', desc: 'Photo of prescription' },
        ].map((mode) => (
          <button
            key={mode.key}
            type="button"
            onClick={() => setInputMode(mode.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              inputMode === mode.key
                ? 'bg-white shadow text-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <p>{mode.label}</p>
            <p className="text-xs opacity-70">{mode.desc}</p>
          </button>
        ))}
      </div>

      {/* Voice Mode */}
      {inputMode === 'voice' && (
        <VoiceDictation
          onMedicinesExtracted={handleVoiceMedicines}
          disabled={submitting}
        />
      )}

      {/* Scan Mode */}
      {inputMode === 'scan' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">
                📸 AI Prescription Scanner
              </p>
              <p className="text-xs text-blue-600 mt-0.5">
                Upload a photo of a prescription to auto-fill the form
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleScanImage}
                className="hidden"
                id="scan-input"
              />
              <label
                htmlFor="scan-input"
                className={`btn-primary text-sm cursor-pointer ${
                  scanning ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {scanning ? '🔄 Scanning...' : '📸 Choose Image'}
              </label>
            </div>
          </div>

          {scannedImageUrl && (
            <div className="mt-3 flex items-center gap-2">
              <img
                src={scannedImageUrl}
                alt="Scanned"
                className="w-16 h-16 object-cover rounded border"
              />
              <p className="text-xs text-green-700">
                ✅ Scanned successfully — form auto-filled
              </p>
            </div>
          )}
        </div>
      )}

      {/* Medicine Rows — always visible */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">
            Medicines
            {fields.length > 0 && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {fields.length} added
              </span>
            )}
          </p>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="border border-gray-200 rounded-lg p-4 bg-gray-50"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Medicine #{index + 1}
                </span>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                  >
                    ✕ Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Medicine Name</label>
                  <input
                    {...register(`medicines.${index}.name`)}
                    className="input"
                    placeholder="e.g., Paracetamol"
                  />
                  {errors.medicines?.[index]?.name && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.medicines[index].name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="label text-xs">Dosage</label>
                  <input
                    {...register(`medicines.${index}.dosage`)}
                    className="input"
                    placeholder="e.g., 500mg"
                  />
                  {errors.medicines?.[index]?.dosage && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.medicines[index].dosage.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="label text-xs">Frequency</label>
                  <select
                    value={watchedMedicines?.[index]?.frequency || ''}
                    onChange={(e) =>
                      handleFrequencyChange(index, e.target.value)
                    }
                    className="input"
                  >
                    <option value="">-- Select Frequency --</option>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.label}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {errors.medicines?.[index]?.frequency && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.medicines[index].frequency.message}
                    </p>
                  )}
                  <input
                    type="hidden"
                    {...register(`medicines.${index}.frequencyCount`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>

                <div>
                  <label className="label text-xs">Duration (days)</label>
                  <input
                    type="number"
                    min="1"
                    {...register(`medicines.${index}.duration`, {
                      valueAsNumber: true,
                    })}
                    className="input"
                    placeholder="e.g., 5"
                  />
                  {errors.medicines?.[index]?.duration && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.medicines[index].duration.message}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="label text-xs">
                    Instructions (optional)
                  </label>
                  <input
                    {...register(`medicines.${index}.instructions`)}
                    className="input"
                    placeholder="e.g., After meals, with water"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => append({ ...emptyMedicine })}
        className="btn-secondary text-sm w-full"
      >
        + Add Medicine
      </button>

      {errors.medicines?.message && (
        <p className="text-red-500 text-xs">{errors.medicines.message}</p>
      )}

      <div>
        <label className="label">Additional Notes (optional)</label>
        <textarea
          {...register('notes')}
          className="input resize-none"
          rows={2}
          placeholder="Any general advice or follow-up instructions..."
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="btn-primary w-full"
      >
        {submitting
          ? 'Generating Prescription...'
          : '📄 Preview & Submit Prescription'}
      </button>
    </form>
  );
};

export default PrescriptionForm;