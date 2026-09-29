import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection } from '../context/InspectionContext';
import { TopBar, Panel, KV, Note, Chip, Kpis, Tabs } from '../components/ui';

const Offline = () => {
  const { session, online, simulatedOffline, setSimulatedOffline, pendingEvidence, syncing, syncNow } = useInspection();
  const navigate = useNavigate();
  const [view, setView] = React.useState('Queue');

  const lastSync = 'Today, 09:12';
  const queued = session.evidence.filter((e) => !e.synced);
  const storedInspections = 3;

  return (
    <>
      <TopBar
        title="Offline & Synchronisation"
        subtitle="Field operations must survive low connectivity"
        onBack={() => navigate('/')}
        right={<Chip tone={online ? 'ok' : 'bad'} dot>{online ? 'ONLINE' : 'OFFLINE'}</Chip>}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <div
          className="g-sync"
          style={{ background: online ? 'var(--navy)' : 'var(--red)' }}
        >
          <div style={{ fontSize: 26 }}>{online ? '📶' : '✈️'}</div>
          <div className="grow">
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.4 }}>
              {online ? 'CONNECTED' : 'OFFLINE MODE'}
            </div>
            <div className="tiny" style={{ opacity: 0.9 }}>
              {online
                ? 'All queued items can be uploaded now.'
                : 'Capture, verification and reporting continue normally. Everything is encrypted on this device.'}
            </div>
          </div>
        </div>

        <Kpis
          items={[
            { label: 'Inspections stored', value: storedInspections, tone: 'info' },
            { label: 'Pending evidence', value: pendingEvidence, tone: pendingEvidence ? 'warn' : 'ok' },
            { label: 'Pending reports', value: session.status === 'submitted' ? 0 : 1, tone: session.status === 'submitted' ? 'ok' : 'warn' },
          ]}
        />

        <Tabs options={['Queue', 'Storage']} value={view} onChange={setView} />

        {view === 'Queue' ? (
          <>
            <Panel title="Waiting for upload" pad={false}>
              <div className="g-panel-bd">
                {queued.length === 0 ? (
                  <div className="g-lede">Nothing is waiting. All evidence has been uploaded.</div>
                ) : (
                  queued.map((e) => (
                    <div key={e.id} className="g-list-row">
                      <div className="g-avatar sm">{e.kind === 'video' ? '🎥' : e.kind === 'document' ? '📄' : e.kind === 'voice' ? '🎙️' : '📷'}</div>
                      <div className="grow">
                        <div className="g-h3">{e.id} · {e.label}</div>
                        <div className="tiny muted">
                          {new Date(e.capturedAt).toLocaleString('en-IN')} · {e.lat.toFixed(4)}, {e.lng.toFixed(4)}
                        </div>
                      </div>
                      <Chip tone="warn">QUEUED</Chip>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel title="Synchronisation">
              <KV k="Last successful sync" v={lastSync} />
              <KV k="Target" v="Central Monitoring System" />
              <KV k="Transport" v="TLS 1.3 · signed payload" />
              <KV k="Conflict policy" v="Server timestamp wins, device log retained" />
            </Panel>

            <button className="g-btn g-btn-go" onClick={syncNow} disabled={!pendingEvidence || syncing}>
              {syncing ? <><span className="spinner" /> Synchronising…</> : `SYNC NOW${pendingEvidence ? ` (${pendingEvidence})` : ''}`}
            </button>
          </>
        ) : (
          <>
            <Panel title="On-device storage">
              <KV k="Mode" v="Encrypted local store" />
              <KV k="Inspections" v={storedInspections} />
              <KV k="Evidence files" v={`${session.evidence.length} items`} />
              <KV k="Size used" v="18.4 MB of 512 MB" />
              <KV k="Encryption" v="AES-256 · device keystore" />
              <KV k="Service worker cache" v="App shell available offline" />
            </Panel>
            <Note tone="info" icon="i">
              The app shell, checklists and the institution register are cached, so an officer can open
              an inspection and work through the full checklist with no connectivity at all.
            </Note>
          </>
        )}

        <Panel title="Demo control">
          <div className="g-lede" style={{ marginBottom: 10 }}>
            Force the device offline to demonstrate the queue, then re-enable it to watch the queue drain
            into the central system.
          </div>
          <button
            className={`g-btn ${simulatedOffline ? 'g-btn-go' : 'g-btn-outline'}`}
            onClick={() => setSimulatedOffline(!simulatedOffline)}
          >
            {simulatedOffline ? 'RESTORE NETWORK CONNECTION' : 'SIMULATE NETWORK FAILURE'}
          </button>
        </Panel>
      </div>
    </>
  );
};

export default Offline;
