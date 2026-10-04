import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useRealtime } from '../services/realtime';
import { useInspection } from '../context/InspectionContext';
import { notificationAPI } from '../services/api';

const TAB_DEFS = [
  { to: '/', key: 'nav.home', icon: '🏠', end: true },
  { to: '/inspections', key: 'nav.inspections', icon: '📋' },
  { to: '/evidence', key: 'nav.evidence', icon: '📷' },
  { to: '/alerts', key: 'nav.alerts', icon: '🔔' },
  { to: '/profile', key: 'nav.profile', icon: '👤' },
];

/** Immersive steps hide the tab bar so the camera / GPS / VC get full height. */
const IMMERSIVE_PREFIXES = ['/vc', '/evidence/capture', '/gps', '/meet'];

const TOAST_ICON = { error: '⚠️', success: '✅', warning: '⚠️', info: '🔔' };

const Toast = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  return (
    <div
      className="toast"
      data-level={toast.level || 'info'}
      onClick={onClose}
      role="alert"
    >
      <span className="toast-icon" aria-hidden="true">{TOAST_ICON[toast.level] || '🔔'}</span>
      <div className="grow">
        <div className="toast-title">{toast.title}</div>
        {toast.body ? <div className="toast-body">{toast.body}</div> : null}
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label={`Dismiss: ${toast.title}`}
        className="toast-close"
      >
        ✕
      </button>
    </div>
  );
};

const Layout = ({ children }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { connected, events } = useRealtime();
  const { online, pendingEvidence, syncing, syncNow } = useInspection();
  const [toasts, setToasts] = useState([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => notificationAPI.list()
      .then(({ data }) => {
        if (!cancelled && Array.isArray(data)) {
          setUnreadAlerts(data.filter((n) => !n.is_read).length);
        }
      })
      .catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

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

  // Reset scroll + move focus to main on route change (screen-reader friendly).
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const immersive = IMMERSIVE_PREFIXES.some((p) => location.pathname.startsWith(p));
  const statusLabel = connected ? t('status.live') : online ? t('status.online') : t('status.offline');
  const statusClass = connected ? 'badge-live' : online ? 'badge-online' : 'badge-offline';
  const TABS = TAB_DEFS.map((tab) => ({ ...tab, label: t(tab.key) }));

  const onTabKeyDown = (e, idx) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = (idx + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    document.querySelectorAll('.tab-bar .tab')[next]?.focus();
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">{t('nav.skip')}</a>
      <header className="app-header" role="banner">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">🛡️</span>
          <div>
            <div className="brand-name">Samaj Drishti</div>
            <div className="brand-sub">{user ? user.name : 'Field Inspection Portal'}</div>
          </div>
        </div>
        <div className="header-badges" role="status" aria-label={`Connection status: ${statusLabel}`}>
          {pendingEvidence > 0 && (
            <button
              type="button"
              className="badge badge-warn"
              title="Evidence waiting to sync — open sync queue"
              onClick={() => navigate('/offline')}
              style={{ border: 'none', cursor: 'pointer' }}
            >
              ⇅ {pendingEvidence}
            </button>
          )}
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
        </div>
      </header>

      {!online && !immersive ? (
        <div style={{ padding: '10px 16px 0' }} role="status">
          <div className="offline-strip">
            <span aria-hidden="true">⚠</span>
            <span className="grow">{t('offline.saved')}{pendingEvidence ? ` · ${pendingEvidence} ${t('offline.queued')}` : ''}</span>
            {pendingEvidence > 0 && online ? (
              <button type="button" className="conn-refresh-btn" onClick={syncNow} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <main id="main-content" ref={mainRef} className="app-main" tabIndex={-1} aria-label="Samaj Drishti field content">
        {children}
      </main>

      {immersive ? null : (
        <nav className="tab-bar" aria-label="Main navigation">
          {TABS.map((tab, idx) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              aria-current={undefined}
              className={({ isActive }) => `tab ${isActive ? 'tab-active' : ''}`}
              onKeyDown={(e) => onTabKeyDown(e, idx)}
            >
              <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
              {tab.to === '/alerts' && unreadAlerts > 0 ? (
                <span className="badge badge-warn tab-badge" aria-label={`${unreadAlerts} unread alerts`}>
                  {unreadAlerts > 9 ? '9+' : unreadAlerts}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      )}

      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => dismissToast(toast.id)} />
        ))}
      </div>
    </div>
  );
};

export default Layout;
