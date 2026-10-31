import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ReportPage } from './pages/ReportPage';
import { FloorReportPage } from './pages/FloorReportPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { MaintenancePage } from './pages/MaintenancePage';
import './styles/global.css';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Route 1: Public Zero-Login Spot Reporter */}
      <Route path="/" element={<Navigate to="/report" replace />} />
      <Route path="/report" element={<ReportPage />} />

      {/* Route 2: New Floor Reporting Page with Room Input & Gemini Genuineness Verification */}
      <Route path="/floor-report" element={<FloorReportPage />} />

      {/* Route 3: Separate Secure Admin Portal strictly for Principal & Management */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={<AdminDashboardPage />} />

      {/* Route 4: Dedicated Maintenance Staff Portal for Uploading Fixed Photo Proof */}
      <Route path="/maintenance" element={<MaintenancePage />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/report" replace />} />
    </Routes>
  );
};

export default App;
