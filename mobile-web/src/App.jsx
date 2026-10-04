import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

const Login = lazy(() => import('./screens/Login'));
const Register = lazy(() => import('./screens/Register'));
const Home = lazy(() => import('./screens/Home'));
const Inspections = lazy(() => import('./screens/Inspections'));
const Assignment = lazy(() => import('./screens/Assignment'));
const GpsVerify = lazy(() => import('./screens/GpsVerify'));
const InspectionRun = lazy(() => import('./screens/InspectionRun'));
const VideoCheck = lazy(() => import('./screens/VideoCheck'));
const BeneficiaryVerification = lazy(() => import('./screens/BeneficiaryVerification'));
const Evidence = lazy(() => import('./screens/Evidence'));
const EvidenceCapture = lazy(() => import('./screens/EvidenceCapture'));
const Checklist = lazy(() => import('./screens/Checklist'));
const AiAnalytics = lazy(() => import('./screens/AiAnalytics'));
const Summary = lazy(() => import('./screens/Summary'));
const Report = lazy(() => import('./screens/Report'));
const Submit = lazy(() => import('./screens/Submit'));
const Offline = lazy(() => import('./screens/Offline'));
const Alerts = lazy(() => import('./screens/Alerts'));
const Profile = lazy(() => import('./screens/Profile'));
const Monitoring = lazy(() => import('./screens/Monitoring'));
const Directory = lazy(() => import('./screens/Directory'));
const Attendance = lazy(() => import('./screens/Attendance'));
const Meet = lazy(() => import('./screens/Meet'));
const InspectionDetail = lazy(() => import('./screens/InspectionDetail'));

const Splash = () => (
  <div className="splash" role="status" aria-label="Restoring session">
    <div className="splash-logo" aria-hidden="true">🛡️</div>
    <div className="splash-title">Samaj Drishti</div>
    <div className="splash-sub">Restoring your session…</div>
  </div>
);

const PageFallback = () => (
  <div className="page-fallback" role="status" aria-label="Loading page">
    <span className="spinner spinner-dark" aria-hidden="true" />
    <span className="small muted">Loading…</span>
  </div>
);

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[mobile] route crash:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="g-panel error-panel" role="alert">
        <div style={{ fontSize: 34 }} aria-hidden="true">⚠️</div>
        <h1 className="g-h1" style={{ marginTop: 8 }}>Something went wrong</h1>
        <p className="g-lede" style={{ marginTop: 6 }}>
          This page hit an unexpected error. Your inspection data is saved on this device.
        </p>
        <button
          type="button"
          className="g-btn g-btn-primary mt"
          onClick={() => this.setState({ error: null })}
        >
          TRY AGAIN
        </button>
      </div>
    );
  }
}

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div className="g-panel error-panel">
      <div style={{ fontSize: 34 }} aria-hidden="true">🧭</div>
      <h1 className="g-h1" style={{ marginTop: 8 }}>Page not found</h1>
      <p className="g-lede" style={{ marginTop: 6 }}>The link you followed doesn&apos;t exist in the field app.</p>
      <button type="button" className="g-btn g-btn-primary mt" onClick={() => navigate('/')}>
        BACK TO HOME
      </button>
    </div>
  );
};

/** Browsers restore the scroll position on back/forward; reset it otherwise. */
const ScrollManager = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const App = () => {
  const { isAuthenticated, restoring } = useAuth();

  if (restoring) return <Splash />;

  if (!isAuthenticated) {
    return (
      <>
        <ScrollManager />
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Login />} />
          </Routes>
        </Suspense>
      </>
    );
  }

  return (
    <Layout>
      <ScrollManager />
      <RouteErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/inspections" element={<Inspections />} />
            <Route path="/assignment" element={<Assignment />} />
            <Route path="/gps" element={<GpsVerify />} />
            <Route path="/inspection/run" element={<InspectionRun />} />
            <Route path="/vc" element={<VideoCheck />} />
            <Route path="/beneficiary" element={<BeneficiaryVerification />} />
            <Route path="/evidence" element={<Evidence />} />
            <Route path="/evidence/capture" element={<EvidenceCapture />} />
            <Route path="/checklist" element={<Checklist />} />
            <Route path="/ai" element={<AiAnalytics />} />
            <Route path="/inspection/summary" element={<Summary />} />
            <Route path="/report" element={<Report />} />
            <Route path="/submit" element={<Submit />} />
            <Route path="/offline" element={<Offline />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/directory" element={<Directory />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/meet" element={<Meet />} />
            <Route path="/inspections/:id" element={<InspectionDetail />} />
            <Route path="/register" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </Layout>
  );
};

export default App;
