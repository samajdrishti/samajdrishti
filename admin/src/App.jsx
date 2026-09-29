import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveMonitoring from './pages/LiveMonitoring';
import Attendance from './pages/Attendance';
import Reports from './pages/Reports';
import Projects from './pages/Projects';
import Inspections from './pages/Inspections';
import Evidence from './pages/Evidence';
import AIInsights from './pages/AIInsights';
import GISMap from './pages/GISMap';
import ATRAdjudication from './pages/ATRAdjudication';
import Settings from './pages/Settings';
import Procedure from './pages/Procedure';
import Users from './pages/Users';
import AuditLogs from './pages/AuditLogs';
import InspectionDetail from './pages/InspectionDetail';
import { isAuthenticated, getStoredUser, clearSession } from './services/api';

const App = () => {
  const [authenticated, setAuthenticated] = useState(() => isAuthenticated());
  const [user, setUser] = useState(() => getStoredUser());

  const handleLogout = () => {
    clearSession();
    setAuthenticated(false);
    setUser(null);
  };

  if (!authenticated) {
    return (
      <Login
        onAuthenticated={(signedInUser) => {
          setUser(signedInUser);
          setAuthenticated(true);
        }}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar user={user} onLogout={handleLogout} />
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: 'calc(100% - 240px)' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/gis-map" element={<GISMap />} />
          <Route path="/atr" element={<ATRAdjudication />} />
          <Route path="/live" element={<LiveMonitoring />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/inspections" element={<Inspections />} />
          <Route path="/inspections/:id" element={<InspectionDetail />} />
          <Route path="/evidence" element={<Evidence />} />
          <Route path="/ai-insights" element={<AIInsights />} />
          <Route path="/procedure" element={<Procedure />} />
          <Route path="/users" element={<Users />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default App;

