import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ReportPage } from './pages/ReportPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { MaintenancePage } from './pages/MaintenancePage';
import './styles/global.css';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Route 1: Public Zero-Login User Reporter (Strict Constraint 1 & 2: Clean, Pictographic, NO CR Layer) */}
      <Route path="/" element={<Navigate to="/report" replace />} />
      <Route path="/report" element={<ReportPage />} />

      {/* Route 2: Separate Secure Admin Portal strictly for Principal & Management (Strict Constraint 3) */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={<AdminDashboardPage />} />

      {/* Route 3: Dedicated Maintenance Staff Portal for Uploading Fixed Photo Proof */}
      <Route path="/maintenance" element={<MaintenancePage />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/report" replace />} />
    </Routes>
  );
};

export default App;
