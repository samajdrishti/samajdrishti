import React from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationAPI } from '../services/api';
import { SectionTitle, Panel, Chip, Empty } from '../components/ui';

const SEVERITY_BY_TYPE = {
  alert: 'high',
  anomaly: 'high',
  assignment: 'medium',
  info: 'medium',
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const Alerts = () => {
  const navigate = useNavigate();
  const [items, setItems] = React.useState(null);
  const [error, setError] = React.useState('');

  const load = React.useCallback(() => {
    notificationAPI.list()
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => setError(err?.response?.data?.message || 'Could not load notifications'));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const open = (n) => {
    if (n.reference_type === 'inspection' && n.reference_id) {
      navigate(`/inspections/${n.reference_id}`);
    } else if (n.reference_type === 'atr' && n.reference_id) {
      navigate(`/inspections?atr=${n.reference_id}`);
    }
    if (!n.is_read) {
      notificationAPI.markRead(n.id).catch(() => {});
      setItems((current) => current.map((c) => (c.id === n.id ? { ...c, is_read: true } : c)));
    }
  };

  const unread = items ? items.filter((n) => !n.is_read).length : 0;

  return (
    <>
      <SectionTitle aside={items ? `${unread} unread` : '…'}>Alert centre</SectionTitle>

      <Panel pad={false}>
        <div className="g-panel-bd">
          {items === null && !error ? (
            <Empty icon="⏳" title="Loading alerts…" desc="" />
          ) : error ? (
            <Empty icon="⚠️" title="Alerts unavailable" desc={error} />
          ) : items.length === 0 ? (
            <Empty icon="🔕" title="No alerts yet" desc="Alerts are raised by the monitoring engine, by the AI engine and by the DoSJE desk." />
          ) : (
            items.map((n) => {
              const severity = SEVERITY_BY_TYPE[n.type] || 'medium';
              const actionable = n.reference_type === 'inspection' || n.reference_type === 'atr';
              return (
                <div
                  key={n.id}
                  className="g-alert-row"
                  style={n.is_read ? { opacity: 0.65 } : undefined}
                  onClick={() => open(n)}
                  role={actionable ? 'button' : undefined}
                >
                  <div className={`g-alert-bar ${severity}`} />
                  <div className="grow">
                    <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                      <span className="g-alert-t">{n.title || 'Notification'}</span>
                      <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>{timeAgo(n.created_at)}</span>
                    </div>
                    <div className="g-alert-m" style={{ marginTop: 3 }}>{n.message}</div>
                    <div className="row" style={{ gap: 8, marginTop: 7 }}>
                      <Chip tone={severity === 'high' ? 'bad' : 'warn'}>{severity}</Chip>
                      {!n.is_read ? <Chip tone="info">unread</Chip> : null}
                      {actionable ? <span className="auth-link" style={{ fontSize: 11.5 }}>Open →</span> : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>

      <Panel title="Alert sources">
        <div className="g-list-row">
          <div className="g-avatar sm" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>⚠</div>
          <div className="grow"><div className="g-h3">CCTV heartbeat monitor</div><div className="tiny muted">Camera silence &gt; 10 minutes</div></div>
        </div>
        <div className="g-list-row">
          <div className="g-avatar sm" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>🤖</div>
          <div className="grow"><div className="g-h3">AI anomaly engine</div><div className="tiny muted">Attendance, pattern and evidence anomalies</div></div>
        </div>
        <div className="g-list-row">
          <div className="g-avatar sm" style={{ background: 'var(--info-bg)', color: 'var(--info-ink)' }}>🎲</div>
          <div className="grow"><div className="g-h3">Randomised allocation engine</div><div className="tiny muted">New duty assignment for the division</div></div>
        </div>
      </Panel>
    </>
  );
};

export default Alerts;
