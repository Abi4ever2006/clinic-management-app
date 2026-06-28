import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { auth } from '../utils/firebase';
import api from '../utils/api';
import useAuthStore from '../store/authStore';
import { Hospital } from 'lucide-react';

const schema = z.object({
  name: z.string().min(2, 'Name too short'),
  age: z.number({ coerce: true }).min(1).max(120),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter valid 10-digit Indian mobile number'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Min 6 characters'),
});

const RegisterPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email, password, name, age, phone }) => {
    if (loading) return;
    setLoading(true);
  try {
    console.log('Step 1 - Starting registration');

    const credential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('Step 2 - Firebase user created:', credential.user.uid);

    const firebaseToken = await credential.user.getIdToken();
    console.log('Step 3 - Got Firebase token');

    const { data } = await api.post(
      '/api/auth/register',
      { name, age, phone },
      { headers: { Authorization: `Bearer ${firebaseToken}` } }
    );
    console.log('Step 4 - Backend response:', data);

    setAuth(data.user, data.token);
    navigate('/patient');
    toast.success('Registration successful! Welcome 🎉');
  } catch (err) {
    console.log('ERROR at step:', err);
    toast.error(err.response?.data?.message || err.message || 'Registration failed');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-xl mb-3">
            <Hospital className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">Register as a patient</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input {...register('name')} className="input" placeholder="John Doe" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Age</label>
              <input type="number" {...register('age')} className="input" placeholder="25" />
              {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age.message}</p>}
            </div>
            <div>
              <label className="label">Phone</label>
              <input {...register('phone')} className="input" placeholder="9876543210" />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" {...register('email')} className="input" placeholder="your@email.com" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" {...register('password')} className="input" placeholder="••••••••" />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
