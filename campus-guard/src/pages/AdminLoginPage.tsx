import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, UserPlus, LogIn } from 'lucide-react';
import { AdminRole, AdminUser } from '../types';
import {
  signInWithGoogleSupabase,
  signInWithSupabasePassword,
  signUpWithSupabase,
  getActiveAdminSession,
} from '../lib/supabaseAuth';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'SIGN_IN' | 'REGISTER'>('SIGN_IN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('PRINCIPAL');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if session already exists or returning from Supabase OAuth
  useEffect(() => {
    // Check for OAuth error in URL hash or query params
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const oauthError =
      hashParams.get('error_description') ||
      queryParams.get('error_description') ||
      hashParams.get('error') ||
      queryParams.get('error');

    if (oauthError) {
      setError(`OAuth Notice (400): ${decodeURIComponent(oauthError)}`);
    }

    async function checkExistingSession() {
      const session = await getActiveAdminSession();
      if (session) {
        navigate('/admin/dashboard', { replace: true });
      }
    }
    checkExistingSession();
  }, [navigate]);

  // Email / Password Form Submit using Supabase Auth
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both your institutional email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setError('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      if (mode === 'SIGN_IN') {
        await signInWithSupabasePassword(email, password, role);
        navigate('/admin/dashboard');
      } else {
        const res = await signUpWithSupabase(email, password, role);
        if (res.user) {
          navigate('/admin/dashboard');
        } else {
          setSuccessMsg(
            res.message ||
              'Admin account registered! If email confirmation is required by your Supabase project, please check your inbox.'
          );
          setMode('SIGN_IN');
        }
      }
    } catch (err: any) {
      console.warn('Auth Error:', err);
      const msg = err.message || '';
      if (msg.toLowerCase().includes('invalid login credentials')) {
        setError(
          'Invalid credentials (400). If you have not created this account yet, click "Create Admin Account" above.'
        );
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        setError(
          'Email not confirmed (400). Please check your email inbox to verify, or disable "Confirm email" in Supabase Dashboard (Auth ➔ Providers ➔ Email).'
        );
      } else {
        setError(msg || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Google Sign-In with Supabase Authentication
  const handleGoogleLogin = async () => {
    setError('');
    setSuccessMsg('');
    setIsGoogleLoading(true);

    try {
      await signInWithGoogleSupabase();
      // Supabase OAuth redirects to Google login page and returns to /admin/dashboard
    } catch (err: any) {
      console.warn('Supabase Google Auth Error:', err);
      const msg = err.message || '';
      setError(
        msg ||
          'Google Sign-In failed. Please try email login or verify Google configuration.'
      );
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
          maxWidth: 460,
          background: 'white',
          borderRadius: 24,
          padding: '36px 30px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
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

          <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
            CampusPulse Admin Portal
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 4 }}>
            Authenticated Principal & Management Command Center (Constraint 3)
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div
          style={{
            display: 'flex',
            background: '#F1F5F9',
            borderRadius: 12,
            padding: 4,
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('SIGN_IN');
              setError('');
              setSuccessMsg('');
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: mode === 'SIGN_IN' ? 'white' : 'transparent',
              color: mode === 'SIGN_IN' ? '#0F172A' : '#64748B',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: mode === 'SIGN_IN' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <LogIn size={15} />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('REGISTER');
              setError('');
              setSuccessMsg('');
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: mode === 'REGISTER' ? 'white' : 'transparent',
              color: mode === 'REGISTER' ? '#0F172A' : '#64748B',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: mode === 'REGISTER' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <UserPlus size={15} />
            <span>Create Admin Account</span>
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div
            style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              color: '#16A34A',
              fontSize: '0.8rem',
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{successMsg}</span>
          </div>
        )}

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
              alignItems: 'flex-start',
              gap: 8,
              color: '#DC2626',
              fontSize: '0.8rem',
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
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
          <span>{isGoogleLoading ? 'Connecting to Google...' : 'Sign in with Google'}</span>
        </button>

        {/* Clean Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>
            {mode === 'SIGN_IN' ? 'Or with Email & Password' : 'Or Register with Email'}
          </span>
          <div style={{ flex: 1, height: 1, background: '#E2E8F0' }} />
        </div>

        {/* Login / Register Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              {mode === 'SIGN_IN' ? 'Administrator Password' : 'Create Password (min. 6 chars)'}
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
            <span>
              {isSubmitting
                ? 'Processing...'
                : mode === 'SIGN_IN'
                ? 'Authorize & Access Dashboard'
                : 'Create Real Supabase Admin'}
            </span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Navigation Links */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
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
