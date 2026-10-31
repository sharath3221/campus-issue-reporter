import React, { useState } from 'react';
import {
  Wrench,
  UserPlus,
  Phone,
  Shield,
  KeyRound,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  X,
  Droplet,
  Zap,
  Sparkles,
  Hammer,
  HelpCircle,
  LucideIcon,
} from 'lucide-react';
import { MaintenanceStaff, StaffSpecialization } from '../types';

interface AdminStaffManagerProps {
  maintenanceStaff: MaintenanceStaff[];
  onAddStaff: (
    staff: Omit<MaintenanceStaff, 'staff_id'> & { staff_id?: string; passcode?: string }
  ) => Promise<boolean>;
  onToggleDuty: (staffId: string, isOnDuty: boolean) => Promise<boolean>;
  onDeleteStaff: (staffId: string) => Promise<boolean>;
}

const SPECIALIZATION_CONFIG: Record<
  StaffSpecialization,
  { label: string; icon: LucideIcon; color: string; bg: string }
> = {
  PLUMBING: { label: 'Plumbing & Water', icon: Droplet, color: '#0288D1', bg: '#E0F2FE' },
  ELECTRICAL: { label: 'Electrical & Power', icon: Zap, color: '#D97706', bg: '#FEF3C7' },
  CLEANING: { label: 'Sanitation & Hygiene', icon: Sparkles, color: '#059669', bg: '#D1FAE5' },
  CARPENTRY: { label: 'Carpentry & Desks', icon: Hammer, color: '#B45309', bg: '#FDE68A' },
  GENERAL: { label: 'General Facilities', icon: Wrench, color: '#6366F1', bg: '#EEF2FF' },
};

export const AdminStaffManager: React.FC<AdminStaffManagerProps> = ({
  maintenanceStaff,
  onAddStaff,
  onToggleDuty,
  onDeleteStaff,
}) => {
  // Form State
  const [fullName, setFullName] = useState('');
  const [specialization, setSpecialization] = useState<StaffSpecialization>('PLUMBING');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [passcode, setPasscode] = useState('1234');
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [specFilter, setSpecFilter] = useState<StaffSpecialization | 'ALL'>('ALL');
  const [showAddForm, setShowAddForm] = useState(false);

  // Handle Add Staff Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phoneNumber.trim()) {
      setFormError('Please provide technician full name and phone number.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    try {
      const success = await onAddStaff({
        full_name: fullName.trim(),
        specialization,
        phone_number: phoneNumber.trim(),
        passcode: passcode.trim() || '1234',
        is_on_duty: isOnDuty,
      });

      if (success) {
        setFormSuccess(true);
        setFullName('');
        setPhoneNumber('');
        setPasscode('1234');
        setTimeout(() => {
          setFormSuccess(false);
          setShowAddForm(false);
        }, 2000);
      } else {
        setFormError('Failed to register technician in Supabase.');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error adding staff member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Staff
  const filteredStaff = maintenanceStaff.filter((staff) => {
    if (specFilter !== 'ALL' && staff.specialization !== specFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        staff.full_name.toLowerCase().includes(q) ||
        staff.phone_number.includes(q) ||
        staff.specialization.toLowerCase().includes(q) ||
        staff.staff_id.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const onDutyCount = maintenanceStaff.filter((s) => s.is_on_duty).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'white',
          borderRadius: 20,
          border: '1px solid #E2E8F0',
          padding: '24px 28px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #0288D1 0%, #01579B 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 4px 12px rgba(2, 136, 209, 0.3)',
              }}
            >
              <Wrench size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                Maintenance Staff Roster & Permissions
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>
                Authorized Technicians for WhatsApp Dispatch & Mobile Duty Login ({onDutyCount}/{maintenanceStaff.length} On Duty)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              border: 'none',
              background: showAddForm ? '#64748B' : '#0F172A',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.2)',
              transition: 'all 0.15s ease',
            }}
          >
            {showAddForm ? (
              <>
                <X size={16} />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <UserPlus size={16} />
                <span>+ Add New Technician</span>
              </>
            )}
          </button>
        </div>

        {/* Add Staff Collapsible Drawer */}
        {showAddForm && (
          <div
            style={{
              marginTop: 24,
              padding: '20px 22px',
              borderRadius: 16,
              background: '#F8FAFC',
              border: '1.5px solid #CBD5E1',
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', marginBottom: 14 }}>
              Register Authorized Maintenance Technician
            </h3>

            {formSuccess && (
              <div
                style={{
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: 10,
                  padding: '10px 14px',
                  marginBottom: 16,
                  color: '#16A34A',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CheckCircle2 size={16} />
                <span>Technician registered successfully in Supabase!</span>
              </div>
            )}

            {formError && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 10,
                  padding: '10px 14px',
                  marginBottom: 16,
                  color: '#DC2626',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form
              onSubmit={handleAddSubmit}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'end' }}
            >
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: 5 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Anand Shinde"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: 5 }}>
                  Trade Specialization
                </label>
                <select
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value as StaffSpecialization)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    background: 'white',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="PLUMBING">Plumbing & Water Supply</option>
                  <option value="ELECTRICAL">Electrical & Power</option>
                  <option value="CLEANING">Sanitation & Janitorial</option>
                  <option value="CARPENTRY">Carpentry & Furniture</option>
                  <option value="GENERAL">General Maintenance</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: 5 }}>
                  Phone Number (WhatsApp & Duty Login)
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: 5 }}>
                  Duty Login PIN / Passcode
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1234"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#0288D1',
                    color: 'white',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Check size={16} />
                  <span>{isSubmitting ? 'Registering...' : 'Save & Authorize Staff'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Roster Controls: Search & Specialization Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['ALL', 'PLUMBING', 'ELECTRICAL', 'CLEANING', 'CARPENTRY', 'GENERAL'] as const).map((spec) => (
            <button
              key={spec}
              type="button"
              onClick={() => setSpecFilter(spec)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: specFilter === spec ? '#0288D1' : '#CBD5E1',
                background: specFilter === spec ? '#0288D1' : 'white',
                color: specFilter === spec ? 'white' : '#475569',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {spec === 'ALL' ? 'All Trades' : SPECIALIZATION_CONFIG[spec].label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 10, top: 10 }} />
          <input
            type="text"
            placeholder="Search name, phone, id..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '7px 12px 7px 30px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: '0.8rem',
              width: 220,
              background: 'white',
            }}
          />
        </div>
      </div>

      {/* Technicians Roster Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {filteredStaff.map((staff) => {
          const config = SPECIALIZATION_CONFIG[staff.specialization] || SPECIALIZATION_CONFIG.GENERAL;
          const SpecIcon = config.icon;

          return (
            <div
              key={staff.staff_id}
              style={{
                background: 'white',
                borderRadius: 16,
                border: '1.5px solid #E2E8F0',
                padding: '18px 20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14,
              }}
            >
              <div>
                {/* Top Badge: Specialization + Duty status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div
                    style={{
                      background: config.bg,
                      color: config.color,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      textTransform: 'uppercase',
                    }}
                  >
                    <SpecIcon size={13} />
                    <span>{staff.specialization}</span>
                  </div>

                  {/* Duty status toggle button */}
                  <button
                    type="button"
                    onClick={() => onToggleDuty(staff.staff_id, !staff.is_on_duty)}
                    style={{
                      border: 'none',
                      background: staff.is_on_duty ? '#DCFCE7' : '#F1F5F9',
                      color: staff.is_on_duty ? '#16A34A' : '#64748B',
                      padding: '3px 8px',
                      borderRadius: 12,
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title="Click to toggle duty status"
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: staff.is_on_duty ? '#16A34A' : '#94A3B8',
                      }}
                    />
                    <span>{staff.is_on_duty ? 'On Duty' : 'Off Duty'}</span>
                  </button>
                </div>

                {/* Name */}
                <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.2 }}>
                  {staff.full_name}
                </div>

                {/* Contact & ID Details */}
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#475569' }}>
                    <Phone size={13} color="#0288D1" />
                    <span style={{ fontWeight: 600 }}>{staff.phone_number}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: '#64748B' }}>
                    <KeyRound size={13} color="#D97706" />
                    <span>PIN Code: <b style={{ fontFamily: 'monospace', color: '#0F172A' }}>{staff.passcode || '1234'}</b></span>
                  </div>

                  <div style={{ fontSize: '0.65rem', color: '#94A3B8', fontFamily: 'monospace', marginTop: 2 }}>
                    ID: {staff.staff_id}
                  </div>
                </div>
              </div>

              {/* Bottom Actions: Quick WhatsApp & Remove */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 10,
                  borderTop: '1px solid #F1F5F9',
                }}
              >
                <a
                  href={`https://wa.me/${staff.phone_number.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#059669',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>Chat on WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to remove technician ${staff.full_name}?`)) {
                      onDeleteStaff(staff.staff_id);
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#EF4444',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 6px',
                    borderRadius: 6,
                  }}
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
