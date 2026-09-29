import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ALERTS, ALERT_FILTERS } from '../data/alerts';
import { SectionTitle, Panel, FilterRow, Chip, Empty, Kpis } from '../components/ui';

const Alerts = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = React.useState('All');

  const rows = ALERTS.filter((a) => (filter === 'All' ? true : a.severity === filter.toLowerCase()));

  return (
    <>
      <SectionTitle aside={`${ALERTS.length} open`}>Alert centre</SectionTitle>

      <Kpis
        items={[
          { label: 'Critical', value: ALERTS.filter((a) => a.severity === 'critical').length, tone: 'bad' },
          { label: 'High', value: ALERTS.filter((a) => a.severity === 'high').length, tone: 'bad' },
          { label: 'Medium', value: ALERTS.filter((a) => a.severity === 'medium').length, tone: 'warn' },
        ]}
      />

      <FilterRow options={ALERT_FILTERS} value={filter} onChange={setFilter} />

      <Panel pad={false}>
        <div className="g-panel-bd">
          {rows.length === 0 ? (
            <Empty icon="🔕" title="No alerts in this category" desc="Alerts are raised by the monitoring engine, by the AI engine and by the DoSJE desk." />
          ) : (
            rows.map((a) => (
              <div key={a.id} className="g-alert-row">
                <div className={`g-alert-bar ${a.severity}`} />
                <div className="grow">
                  <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                    <span className="g-alert-t">{a.title}</span>
                    <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>{a.time}</span>
                  </div>
                  <div className="g-alert-m">{a.institution}</div>
                  <div className="g-alert-m" style={{ marginTop: 3 }}>{a.body}</div>
                  <div className="row" style={{ gap: 8, marginTop: 7 }}>
                    <Chip tone={a.severity === 'critical' || a.severity === 'high' ? 'bad' : a.severity === 'medium' ? 'warn' : 'info'}>
                      {a.severity}
                    </Chip>
                    {a.action ? (
                      <button
                        type="button"
                        className="auth-link"
                        style={{ fontSize: 11.5 }}
                        onClick={() => a.target && navigate(a.target)}
                      >
                        {a.action} →
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
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
