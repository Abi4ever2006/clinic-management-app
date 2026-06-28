import { create } from 'zustand';

const useClinicStore = create((set) => ({
  appointments: [],
  doctors: [],

  setAppointments: (appointments) => set({ appointments }),

  addAppointment: (appointment) =>
    set((state) => ({
      appointments: [
        ...state.appointments,
        appointment,
      ].sort((a, b) => a.tokenNumber - b.tokenNumber),
    })),

  updateAppointment: (updated) =>
    set((state) => ({
      appointments: state.appointments.map((a) =>
        a._id === updated._id ? updated : a
      ),
    })),

  setDoctors: (doctors) => set({ doctors }),
}));

export default useClinicStore;