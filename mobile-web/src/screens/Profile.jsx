import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInspection } from '../context/InspectionContext';
import { SectionTitle, Panel, KV, Chip, Note, Kpis } from '../components/ui';

const Profile = () => {
  const { user, logout } = useAuth();
  const { session, online, simulatedOffline, setSimulatedOffline, resetDemo, checklistDone, pendingEvidence } = useInspection();
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

      <SectionTitle>Offline storage</SectionTitle>
      <Panel>
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
        <KV k="Checklist" v={`${checklistDone} / 24`} />
        <button className="g-btn g-btn-quiet g-btn-sm mt" onClick={() => navigate('/inspection/run')}>
          {s.status === 'submitted' ? 'View report' : 'Resume inspection'}
        </button>
      </Panel>

      <Note tone="mute" icon="i">
        DoSJE SmartInspect · Ministry of Social Justice &amp; Empowerment
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
