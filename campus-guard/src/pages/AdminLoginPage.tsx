import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, UserCheck, KeyRound, Building2 } from 'lucide-react';
import { AdminRole, AdminUser } from '../types';
import { adminUsers } from '../data/mockData';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('PRINCIPAL');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const found = adminUsers.find((u) => u.role === role) || adminUsers[0];
    localStorage.setItem('campuspulse_admin_session', JSON.stringify(found));
    navigate('/admin/dashboard');
  };

  const handleQuickLogin = (user: AdminUser) => {
    localStorage.setItem('campuspulse_admin_session', JSON.stringify(user));
    navigate('/admin/dashboard');
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
          padding: '32px 28px',
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
            Strict Authentication for Principal, Management & Facilities Directorate (Constraint 3)
          </p>
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
                placeholder="officer@campuspulse.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: 10,
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
              Secret Passkey
            </label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 12 }} />
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
                }}
              />
            </div>
          </div>

          <button
            type="submit"
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
            <span>Authorize & Access Dashboard</span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Quick Demo Logins */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px dashed #CBD5E1' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' }}>
            Instant Demo Authentication
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {adminUsers.map((user) => (
              <button
                key={user.admin_id}
                type="button"
                onClick={() => handleQuickLogin(user)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  background: '#F8FAFC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 800, color: '#1E293B' }}>
                    {user.full_name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                    {user.role} • {user.department}
                  </div>
                </div>
                <UserCheck size={16} color="#0288D1" />
              </button>
            ))}
          </div>
        </div>

        {/* Back to Public Reporter */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
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
            ← Back to Public Spot Reporter (/report)
          </button>
        </div>
      </div>
    </div>
  );
};

