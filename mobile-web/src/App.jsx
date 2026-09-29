import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './screens/Login';
import Home from './screens/Home';
import Inspections from './screens/Inspections';
import Assignment from './screens/Assignment';
import GpsVerify from './screens/GpsVerify';
import InspectionRun from './screens/InspectionRun';
import VideoCheck from './screens/VideoCheck';
import Evidence from './screens/Evidence';
import EvidenceCapture from './screens/EvidenceCapture';
import Checklist from './screens/Checklist';
import AiAnalytics from './screens/AiAnalytics';
import Summary from './screens/Summary';
import Submit from './screens/Submit';
import Offline from './screens/Offline';
import Alerts from './screens/Alerts';
import Profile from './screens/Profile';
import Monitoring from './screens/Monitoring';

const Splash = () => (
  <div className="splash">
    <div className="splash-logo">🛡️</div>
    <div className="splash-title">DoSJE SmartInspect</div>
    <div className="splash-sub">Restoring your session…</div>
  </div>
);

const App = () => {
  const { isAuthenticated, restoring } = useAuth();

  if (restoring) return <Splash />;

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/inspections" element={<Inspections />} />
        <Route path="/assignment" element={<Assignment />} />
        <Route path="/gps" element={<GpsVerify />} />
        <Route path="/inspection/run" element={<InspectionRun />} />
        <Route path="/vc" element={<VideoCheck />} />
        <Route path="/evidence" element={<Evidence />} />
        <Route path="/evidence/capture" element={<EvidenceCapture />} />
        <Route path="/checklist" element={<Checklist />} />
        <Route path="/ai" element={<AiAnalytics />} />
        <Route path="/inspection/summary" element={<Summary />} />
        <Route path="/submit" element={<Submit />} />
        <Route path="/offline" element={<Offline />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

export default App;
