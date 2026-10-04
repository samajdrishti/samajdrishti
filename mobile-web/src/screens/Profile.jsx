import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { pushStatus, subscribePush, unsubscribePush } from '../services/push';
import { useInspection } from '../context/InspectionContext';
import { SectionTitle, Panel, KV, Chip, Note, Kpis } from '../components/ui';

const Profile = () => {
  const { user, logout } = useAuth();
  const { t, lang, setLang, langs } = useLanguage();
  const [push, setPush] = useState({ state: 'unknown', reason: '' });
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    pushStatus()
      .then((s) => { if (!cancelled) setPush(s); })
      .catch((err) => { if (!cancelled) setPush({ state: 'unsupported', reason: String(err?.message || err) }); });
    return () => { cancelled = true; };
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (push.state === 'subscribed') {
        await unsubscribePush();
        setPush({ state: 'off', reason: 'Push alerts are off on this device.' });
      } else {
        await subscribePush();
        setPush({ state: 'subscribed', reason: '' });
      }
    } catch (err) {
      setPush((p) => ({ ...p, reason: err?.message || 'Could not change push setting.' }));
    } finally {
      setPushBusy(false);
    }
  };
  const { session, online, simulatedOffline, setSimulatedOffline, resetDemo, checklistDone, checklistTotal, pendingEvidence } = useInspection();
  const navigate = useNavigate();
  const s = session;
  const o = user || s.officer;
  const initials = String(o.name || 'SK').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  const completed = s.status === 'submitted' ? 3 : 2;
  const pending = 4 - completed;

  return (
    <>
      <SectionTitle>Officer profile</SectionTitle>

      <Panel>
        <div className="row" style={{ gap: 12 }}>
          <div className="g-avatar lg">{initials}</div>
          <div className="grow">
            <div className="g-h1">{o.name}</div>
            <div className="small muted">{o.role || s.officer.rank}</div>
            <div className="row" style={{ gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
              <Chip tone="info" dot>INSPECTION OFFICER</Chip>
              <Chip tone={online ? 'ok' : 'bad'} dot>{online ? 'ONLINE' : 'OFFLINE'}</Chip>
            </div>
          </div>
        </div>
        <div className="divider" />
        <KV k="Official ID" v={s.officer.id} mono />
        <KV k="Registered mobile" v={s.officer.phone} mono />
        <KV k="District" v={s.officer.district} />
        <KV k="Assigned division" v={s.officer.division} />
        <KV k="Scheme verticals" v="SIPDA · NAPDDR · AVYAY" />
        <KV k="Role" v="PMU / Inspection Officer" />
      </Panel>

      <SectionTitle>{t('profile.language')}</SectionTitle>
      <Panel>
        <div className="g-tabs" role="group" aria-label={t('profile.language')}>
          {langs.map((l) => (
            <button key={l.id} type="button" className={lang === l.id ? 'on' : ''} onClick={() => setLang(l.id)} aria-pressed={lang === l.id}>
              {l.label}
            </button>
          ))}
        </div>
      </Panel>

      <SectionTitle>Performance</SectionTitle>
      <Kpis
        items={[
          { label: 'Completed', value: completed, tone: 'ok' },
          { label: 'Pending', value: pending, tone: 'warn' },
          { label: 'Findings raised', value: 3, tone: 'info' },
        ]}
      />

      <SectionTitle>Device &amp; security</SectionTitle>
      <Panel>
        <KV k="Device" v="Android · Field handset" />
        <KV k="Device security" v={<Chip tone="ok" dot>PASSCODE + BIOMETRIC</Chip>} />
        <KV k="Session" v={<Chip tone="ok" dot>TLS 1.3 · JWT</Chip>} />
        <KV k="Network" v={online ? 'Connected' : 'Offline'} />
        <KV k="Last sync" v="Today, 09:12" />
        <KV k="Location services" v={<Chip tone="ok" dot>HIGH ACCURACY</Chip>} />
      </Panel>

      <SectionTitle>Notifications</SectionTitle>
      <Panel>
        <KV k="Push alerts" v={<Chip tone={push.state === 'subscribed' ? 'ok' : 'mute'} dot>{push.state === 'subscribed' ? 'ON' : push.state.toUpperCase()}</Chip>} />
        {push.reason ? <div className="tiny muted" style={{ margin: '6px 0' }}>{push.reason}</div> : null}
        <div className="tiny muted" style={{ marginBottom: 8 }}>
          New assignments and critical alerts even with the app closed. In-app alerts already arrive live over the realtime channel.
        </div>
        <button
          type="button"
          className={`g-btn ${push.state === 'subscribed' ? 'g-btn-quiet' : 'g-btn-primary'} g-btn-sm`}
          onClick={togglePush}
          disabled={pushBusy || push.state === 'unsupported' || push.state === 'blocked' || push.state === 'unknown'}
        >
          {pushBusy ? 'WORKING…' : push.state === 'subscribed' ? 'TURN OFF PUSH' : 'TURN ON PUSH'}
        </button>
      </Panel>

      <SectionTitle>Offline storage</SectionTitle>      <Panel>
        <KV k="Local store" v="Encrypted (AES-256)" />
        <KV k="Inspections stored" v={3} />
        <KV k="Evidence queued" v={pendingEvidence} />
        <KV k="Storage used" v="18.4 MB / 512 MB" />
        <div className="g-btn-row mt">
          <button className="g-btn g-btn-quiet g-btn-sm" onClick={() => navigate('/offline')}>
            Sync settings
          </button>
          <button
            className="g-btn g-btn-quiet g-btn-sm"
            onClick={() => setSimulatedOffline(!simulatedOffline)}
          >
            {simulatedOffline ? 'Go online' : 'Simulate offline'}
          </button>
        </div>
      </Panel>

      <SectionTitle>Current inspection</SectionTitle>
      <Panel>
        <KV k="Inspection" v={s.inspectionId} mono />
        <KV k="Institution" v={s.institution.name} />
        <KV k="Status" v={<Chip tone={s.status === 'submitted' ? 'ok' : s.status === 'assigned' ? 'warn' : 'info'} dot>{s.status.replace(/_/g, ' ')}</Chip>} />
        <KV k="Checklist" v={`${checklistDone} / ${checklistTotal}`} />
        <button className="g-btn g-btn-quiet g-btn-sm mt" onClick={() => navigate('/inspection/run')}>
          {s.status === 'submitted' ? 'View report' : 'Resume inspection'}
        </button>
      </Panel>

      <Note tone="mute" icon="i">
        Samaj Drishti · Ministry of Social Justice &amp; Empowerment
        <br />
        SIH 2026 · PS 26095 · v1.0 prototype
      </Note>

      <button className="g-btn g-btn-quiet" onClick={resetDemo}>
        Reset demo data
      </button>
      <button className="g-btn g-btn-alert" onClick={logout}>
        LOGOUT
      </button>
    </>
  );
};

export default Profile;
