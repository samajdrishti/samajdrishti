import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../services/realtime';
import { useInspection } from '../context/InspectionContext';

const TABS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/inspections', label: 'Inspections', icon: '📋' },
  { to: '/evidence', label: 'Evidence', icon: '📷' },
  { to: '/alerts', label: 'Alerts', icon: '🔔' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

const Toast = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  return (
    <div className={`toast toast-${toast.level}`} onClick={onClose}>
      <span className="toast-icon">{toast.level === 'error' ? '⚠️' : toast.level === 'success' ? '✅' : '🔔'}</span>
      <div>
        <div className="toast-title">{toast.title}</div>
        <div className="toast-body">{toast.body}</div>
      </div>
    </div>
  );
};

const Layout = ({ children }) => {
  const { user } = useAuth();
  const { connected, events } = useRealtime();
  const { online, pendingEvidence, session } = useInspection();
  const [toasts, setToasts] = useState([]);
  const location = useLocation();

  useEffect(() => {
    if (!events.length) return;
    const latest = events[0];
    const map = {
      notification: { level: 'info', title: 'Notification', body: latest.payload?.message },
      alert: { level: latest.payload?.severity === 'high' ? 'error' : 'info', title: 'Alert', body: latest.payload?.message },
      inspection: {
        level: 'info',
        title: 'Inspection update',
        body: latest.payload?.inspection ? `${latest.payload.inspection.id || 'Inspection'} is now ${latest.payload.status}` : '',
      },
      vc: { level: 'info', title: 'Video verification', body: `Live review connected: ${latest.payload?.session?.project_name || ''}` },
    };
    const mapping = map[latest.type];
    if (!mapping || !mapping.body) return;
    setToasts((current) => {
      if (current.some((t) => t.id === latest.id)) return current;
      return [{ id: latest.id, ...mapping }, ...current].slice(0, 3);
    });
  }, [events]);

  // Hide the tab bar on the immersive inspection steps.
  const immersive = ['/vc', '/evidence/capture', '/gps'].some((p) => location.pathname.startsWith(p));

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">🛡️</span>
          <div>
            <div className="brand-name">DoSJE SmartInspect</div>
            <div className="brand-sub">{user ? user.name : 'Field Inspection Portal'}</div>
          </div>
        </div>
        <div className="header-badges">
          {pendingEvidence > 0 && <span className="badge badge-warn" title="Waiting to sync">⇅ {pendingEvidence}</span>}
          <span className={`badge ${connected || online ? 'badge-live' : 'badge-offline'}`}>
            {connected || online ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </header>

      <main className="app-main">{children}</main>

      <nav className="tab-bar">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `tab ${isActive ? 'tab-active' : ''}`}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.to === '/alerts' && session.status !== 'submitted' ? <span className="badge badge-warn" style={{ position: 'absolute', top: 6, right: 22 }}>2</span> : null}
          </NavLink>
        ))}
      </nav>

      <div className="toast-stack">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => setToasts((c) => c.filter((t) => t.id !== toast.id))} />
        ))}
      </div>
    </div>
  );
};

export default Layout;
