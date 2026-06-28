import { create } from 'zustand';

const useAuthStore = create((set) => ({
    user: JSON.parse(localStorage.getItem('clinic_user')) || null,
    token: localStorage.getItem('clinic_token') || null,
    
    setAuth: (user, token) => {
        localStorage.setItem('clinic_user', JSON.stringify(user));
        localStorage.setItem('clinic_token', token);
        set({ user, token });
    },

    clearAuth: () => {
        localStorage.removeItem('clinic_user');
        localStorage.removeItem('clinic_token');
        set({ user: null, token: null });
    }
}));

export default useAuthStore;