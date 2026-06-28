import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { auth } from '../utils/firebase';
import api from '../utils/api';
import useAuthStore from '../store/authStore';
import { Hospital } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Min 6 characters'),
  role: z.enum(['patient', 'doctor', 'admin']),
});

const LoginPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { role: 'patient' },
  });

  const onSubmit = async ({ email, password, role }) => {
    if (loading) return;
    setLoading(true);
    try {
      // Step 1: Firebase login
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseToken = await credential.user.getIdToken();

      // Step 2: Exchange for our JWT
      const { data } = await api.post(
        '/api/auth/login',
        { role },
        { headers: { Authorization: `Bearer ${firebaseToken}` } }
      );

      setAuth(data.user, data.token);
      const dashMap = { patient: '/patient', admin: '/admin', doctor: '/doctor' };
      navigate(dashMap[role]);
      toast.success(`Welcome back, ${data.user.name}!`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-xl mb-3">
            <Hospital className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Clinic Management</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Role */}
          <div>
            <label className="label">Sign in as</label>
            <select {...register('role')} className="input">
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Email */}
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              {...register('email')}
              className="input"
              placeholder="your@email.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              {...register('password')}
              className="input"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          New patient?{' '}
          <Link to="/register" className="text-blue-600 font-medium hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
