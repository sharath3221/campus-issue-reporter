import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, KeyRound, AlertCircle } from 'lucide-react';
import { AdminRole, AdminUser } from '../types';
import {
  signInWithGoogleSupabase,
  signInWithSupabasePassword,
  getActiveAdminSession,
} from '../lib/supabaseAuth';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('PRINCIPAL');
  const [error, setError] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if session already exists or returning from Supabase OAuth
  useEffect(() => {
    async function checkExistingSession() {
      const session = await getActiveAdminSession();
      if (session) {
        navigate('/admin/dashboard', { replace: true });
      }
    }
    checkExistingSession();
  }, [navigate]);

  // Email / Password Form Submit using Supabase Auth
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both your institutional email and password.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await signInWithSupabasePassword(email, password, role);
      navigate('/admin/dashboard');
    } catch (err: any) {
      console.warn('Auth Error:', err);
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Google Sign-In with Supabase Authentication
  const handleGoogleLogin = async () => {
    setError('');
    setIsGoogleLoading(true);

    try {
      await signInWithGoogleSupabase();
      // Supabase OAuth redirects to Google login page and returns to /admin/dashboard
    } catch (err: any) {
      console.warn('Supabase Google Auth Error:', err);
      setError(err.message || 'Google Sign-In failed or domain is not authorized in Supabase Auth.');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'white',
          borderRadius: 24,
          padding: '36px 30px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              margin: '0 auto 12px',
              boxShadow: '0 4px 12px rgba(2, 136, 209, 0.4)',
            }}
          >
            <Shield size={28} />
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
            CampusPulse Admin Portal
          </h1>
          <p style={{ fontSize: '0.825rem', color: '#64748B', marginTop: 4 }}>
            Strict Authentication for Principal, Management & Administrative Officers (Constraint 3)
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#DC2626',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Google Sign-In using Supabase Auth */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading || isSubmitting}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            border: '1.5px solid #CBD5E1',
            background: 'white',
            color: '#0F172A',
            fontSize: '0.92rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            transition: 'all 0.15s ease',
          }}
        >
          {/* Official Google Icon */}
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{isGoogleLoading ? 'Connecting to Google with Supabase...' : 'Sign in with Google'}</span>
        </button>

        {/* Clean Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>
            Or with Email & Password
          </span>
          <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
              Administrative Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1.5px solid #CBD5E1',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#1E293B',
                background: 'white',
              }}
            >
              <option value="PRINCIPAL">College Principal</option>
              <option value="MANAGEMENT">Governing Management</option>
              <option value="ADMIN">Head Administrative Officer</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
              Institutional Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input
                type="email"
                placeholder="admin@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: 10,
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
              Administrator Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: 10,
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 12,
              border: 'none',
              background: '#0F172A',
              color: 'white',
              fontSize: '0.95rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 6,
            }}
          >
            <span>{isSubmitting ? 'Authenticating...' : 'Authorize & Access Dashboard'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Navigation Links */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24 }}>
          <button
            onClick={() => navigate('/report')}
            style={{
              background: 'none',
              border: 'none',
              color: '#0288D1',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← Public Reporter
          </button>
          <span style={{ color: '#CBD5E1' }}>•</span>
          <button
            onClick={() => navigate('/maintenance')}
            style={{
              background: 'none',
              border: 'none',
              color: '#D97706',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🔧 Maintenance Portal →
          </button>
        </div>
      </div>
    </div>
  );
};
