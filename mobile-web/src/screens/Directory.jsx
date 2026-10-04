import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInspection } from '../context/InspectionContext';
import { useLanguage } from '../context/LanguageContext';
import { TopBar, Panel, KV, Chip, Tabs, Empty, FilterRow } from '../components/ui';
import { monitoringAPI } from '../services/api';
import { useNearbyCenters, useCameraPins } from '../hooks/useNearbyCenters';
import { haversineDistanceM, formatDistance } from '../services/geo';

const dirOf = (c) => `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;

const CenterRow = ({ c, refPoint }) => {
  const d = refPoint && Number.isFinite(Number(c.lat))
    ? haversineDistanceM(refPoint, { lat: Number(c.lat), lng: Number(c.lng) })
    : null;
  const head = c.head || {};
  return (
    <div className="g-list-row">
      <div className="g-avatar sm" style={{ background: c.status === 'flagged' ? 'var(--red-bg)' : 'var(--green-bg)', color: c.status === 'flagged' ? 'var(--red)' : 'var(--green-ink)' }} aria-hidden="true">
        {c.status === 'flagged' ? '!' : '🏛️'}
      </div>
      <div className="grow">
        <div className="g-h3">{c.name}</div>
        <div className="tiny muted">{c.location}{c.scheme ? ` · ${c.scheme}` : ''}</div>
        <div className="row" style={{ gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
          <Chip tone={c.status === 'flagged' ? 'bad' : c.status === 'active' ? 'ok' : 'mute'} dot>{c.status || 'unknown'}</Chip>
          {d != null && Number.isFinite(d) ? <span className="tiny muted">{formatDistance(d)} away</span> : null}
          {c.camera_count != null ? <span className="tiny muted">{c.camera_count} camera(s)</span> : null}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {head.phone ? (
          <a className="g-btn g-btn-quiet g-btn-sm" href={`tel:${head.phone}`} aria-label={`Call ${c.name}`}>
            Call
          </a>
        ) : null}
        <button
          type="button"
          className="g-btn g-btn-quiet g-btn-sm"
          onClick={() => window.open(dirOf({ lat: c.geo_coords.lat, lng: c.geo_coords.lng }), '_blank', 'noopener')}
        >
          Route
        </button>
      </div>
    </div>
  );
};

const CameraRow = ({ c }) => {
  const online = c.online ?? c.status === 'online';
  return (
    <div className="g-list-row">
      <div className="g-avatar sm" style={{ background: online ? 'var(--info-bg)' : 'var(--red-bg)', color: online ? 'var(--info-ink)' : 'var(--red)' }} aria-hidden="true">
        {online ? '📹' : '○'}
      </div>
      <div className="grow">
        <div className="g-h3">{c.name}</div>
        <div className="tiny muted">{c.project_name || c.location || ''}</div>
        <div className="row" style={{ gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
          <Chip tone={online ? 'info' : 'bad'} dot>{online ? 'LIVE' : 'NO SIGNAL'}</Chip>
          {c.tamper_flag && c.tamper_flag !== 'normal' ? (
            <Chip tone="warn">{String(c.tamper_flag).replace(/_/g, ' ')}</Chip>
          ) : null}
        </div>
        {c.anomaly_note ? <div className="tiny muted" style={{ marginTop: 3 }}>{c.anomaly_note}</div> : null}
      </div>
      {online ? (
        <img
          src={monitoringAPI.snapshotUrl(c.id)}
          alt={`${c.name} snapshot`}
          style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }}
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : null}
    </div>
  );
};

const Directory = () => {
  const { session, online } = useInspection();
  const { t } = useLanguage();
  const { centers, loading: loadingCenters, refresh: refreshCenters } = useNearbyCenters(online);
  const { cameras, refresh: refreshCameras } = useCameraPins(online);
  const navigate = useNavigate();
  const [tab, setTab] = useState('Centers');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');

  const refPoint = session.gps && Number.isFinite(Number(session.gps.lat))
    ? { lat: Number(session.gps.lat), lng: Number(session.gps.lng) }
    : { lat: session.institution.lat, lng: session.institution.lng };

  const q = query.trim().toLowerCase();
  const visibleCenters = useMemo(() => centers
    .filter((c) => (status === 'All' ? true : String(c.status).toLowerCase() === status.toLowerCase()))
    .filter((c) => !q || [c.name, c.location, c.scheme, c.head?.name].filter(Boolean).join(' ').toLowerCase().includes(q))
    .map((c) => ({
      row: c,
      lat: Number(c.geo_coords?.lat),
      lng: Number(c.geo_coords?.lng),
      d: c.geo_coords ? haversineDistanceM(refPoint, { lat: Number(c.geo_coords.lat), lng: Number(c.geo_coords.lng) }) : NaN,
    }))
    .sort((a, b) => (Number.isFinite(a.d) ? a.d : Infinity) - (Number.isFinite(b.d) ? b.d : Infinity)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [centers, q, status]);

  const visibleCameras = useMemo(() => cameras.filter((c) => {
    if (!q) return true;
    return [c.name, c.project_name, c.location].filter(Boolean).join(' ').toLowerCase().includes(q);
  }), [cameras, q]);

  const refreshAll = () => { refreshCenters(); refreshCameras(); };

  return (
    <>
      <TopBar
        title={t('dir.title')}
        subtitle={`${centers.length} centers · ${cameras.length} cameras`}
        onBack={() => navigate('/')}
        right={<Chip tone={online ? 'ok' : 'bad'} dot>{online ? 'LIVE' : 'CACHED'}</Chip>}
      />

      <div className="g-panel-bd stack" style={{ gap: 14 }}>
        <Tabs options={[t('dir.centers'), t('dir.cameras')]} value={tab === 'Centers' ? t('dir.centers') : t('dir.cameras')} onChange={(v) => setTab(v === t('dir.cameras') ? 'Cameras' : 'Centers')} />

        <input
          className="input"
          type="search"
          placeholder={tab === 'Centers' ? t('dir.searchCenters') : t('dir.searchCameras')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search directory"
        />

        {tab === 'Centers' ? (
          <>
            <FilterRow options={['All', 'Active', 'Flagged']} value={status} onChange={setStatus} />
            <Panel title={`Monitored centers (${visibleCenters.length})`} pad={false}>
              <div className="g-panel-bd">
                {loadingCenters && !visibleCenters.length ? (
                  <div className="row" style={{ gap: 8, padding: '12px 0' }}>
                    <span className="spinner spinner-dark" aria-hidden="true" />
                    <span className="small muted">Loading district directory…</span>
                  </div>
                ) : visibleCenters.length === 0 ? (
                  <Empty icon="🏛️" title="No centers found" desc="Adjust the search or status filter." />
                ) : (
                  visibleCenters.map(({ row }) => <CenterRow key={row.id} c={row} refPoint={refPoint} />)
                )}
              </div>
            </Panel>
            {!online ? (
              <div className="tiny muted center">Offline — showing the last synced directory.</div>
            ) : null}
          </>
        ) : (
          <Panel title={`CCTV cameras (${visibleCameras.length})`} pad={false}>
            <div className="g-panel-bd">
              {visibleCameras.length === 0 ? (
                <Empty icon="📹" title="No cameras found" desc="Adjust the search." />
              ) : (
                visibleCameras.map((c) => <CameraRow key={c.id} c={c} />)
              )}
            </div>
          </Panel>
        )}

        <button type="button" className="g-btn g-btn-quiet" onClick={refreshAll} disabled={!online}>
          {t('dir.refresh')}
        </button>

        <Panel title="About this directory">
          <KV k="Source" v="Central Monitoring System · /gis/centers" />
          <KV k="Coverage" v="NGO grant-aided homes + departmental institutions" />
          <KV k="Distances" v={session.gps ? 'From your live GPS fix' : 'From your assigned institution'} />
        </Panel>
      </div>
    </>
  );
};

export default Directory;
