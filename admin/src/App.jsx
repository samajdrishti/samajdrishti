import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Toolbar, IconButton, useMediaQuery, useTheme } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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
      <Sidebar user={user} onLogout={handleLogout} mobile={isMobile} open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, width: isMobile ? '100%' : 'calc(100% - 250px)', p: { xs: 2, sm: 2.5, lg: 3.5 } }}>
        {isMobile && (
          <Toolbar disableGutters sx={{ minHeight: 48, mb: 1 }}>
            <IconButton aria-label="Open navigation" onClick={() => setMobileNavOpen(true)} sx={{ color: 'text.primary' }}>
              <MenuIcon />
            </IconButton>
          </Toolbar>
        )}
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
