import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection } from '../context/InspectionContext';
import { SectionTitle, Panel, Empty, Chip, FilterRow, KV, Note } from '../components/ui';

const FILTERS = ['All', 'Photo', 'Video', 'Document', 'Voice'];

const Evidence = () => {
  const { session, online } = useInspection();
  const navigate = useNavigate();
  const [filter, setFilter] = React.useState('All');
  const [open, setOpen] = React.useState(null);

  const items = session.evidence.filter((e) => (filter === 'All' ? true : e.kind === filter.toLowerCase()));

  return (
    <>
      <SectionTitle aside={`${session.evidence.length} items`}>Evidence locker</SectionTitle>

      <button className="g-btn g-btn-primary" onClick={() => navigate('/evidence/capture')}>
        📷 &nbsp;CAPTURE EVIDENCE
      </button>

      {session.evidence.length === 0 ? (
        <Panel>
          <Empty
            icon="📷"
            title="No evidence captured yet"
            desc="Every item is sealed with GPS coordinates, timestamp, inspection ID and a SHA-256 integrity hash at the moment of capture."
          />
        </Panel>
      ) : (
        <>
          <FilterRow options={FILTERS} value={filter} onChange={setFilter} />

          {!online ? (
            <Note tone="warn" icon="⚠">
              Offline — {session.evidence.filter((e) => !e.synced).length} item(s) queued for upload.
            </Note>
          ) : null}

          <Panel title="Captured items" pad={false}>
            <div className="g-panel-bd">
              <div className="g-ev-grid">
                {items.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="g-ev"
                    onClick={() => setOpen(e)}
                    style={{ padding: 0, cursor: 'pointer' }}
                  >
                    {e.dataUrl ? <img src={e.dataUrl} alt={e.label} /> : (
                      <div className="g-ev-doc">
                        <span style={{ fontSize: 18 }}>{e.kind === 'voice' ? '🎙️' : '📄'}</span>
                        <span style={{ fontSize: 8.5, fontWeight: 700 }}>{e.kind}</span>
                      </div>
                    )}
                    <span className="g-ev-n">{e.id}</span>
                    <span className="g-ev-tag">{e.synced ? 'SYNCED' : 'PENDING'}</span>
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          {open ? (
            <Panel
              title={`${open.id} · ${open.label}`}
              aside={<button type="button" className="auth-link" style={{ fontSize: 12 }} onClick={() => setOpen(null)}>Close</button>}
            >
              {open.dataUrl ? <img src={open.dataUrl} alt={open.label} style={{ width: '100%', borderRadius: 10, display: 'block', marginBottom: 10 }} /> : null}
              <KV k="Type" v={open.kind} />
              <KV k="Captured at" v={new Date(open.capturedAt).toLocaleString('en-IN')} mono />
              <KV k="Coordinates" v={`${open.lat.toFixed(4)}, ${open.lng.toFixed(4)}`} mono />
              <KV k="Geo-tagging" v={<Chip tone="ok" dot>ENABLED</Chip>} />
              <KV k="Integrity" v={open.integrity} mono />
              <KV k="Upload" v={<Chip tone={open.synced ? 'ok' : 'warn'} dot>{open.synced ? 'SYNCED' : 'PENDING UPLOAD'}</Chip>} />
            </Panel>
          ) : null}
        </>
      )}
    </>
  );
};

export default Evidence;
