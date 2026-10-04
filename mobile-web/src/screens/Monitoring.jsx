import { useCallback, useEffect, useState } from 'react';
import { monitoringAPI } from '../services/api';
import { useRealtime } from '../services/realtime';

const REFRESH_MS = 10000;

const clock = () =>
  new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

const Monitoring = () => {
  const [cameras, setCameras] = useState([]);
  const [overview, setOverview] = useState(null);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const { events } = useRealtime();

  const load = useCallback(async () => {
    try {
      const [cams, over] = await Promise.all([
        monitoringAPI.cameras(),
        monitoringAPI.overview().catch(() => null),
      ]);
      setCameras(Array.isArray(cams.data) ? cams.data : []);
      if (over) setOverview(over.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the monitoring service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live frames: refresh the <img> sources a few times a second apart.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // Camera health arrives over the socket every 5 s.
  useEffect(() => {
    const latest = events.find((e) => e.type === 'monitoring');
    if (latest) setOverview((current) => (current ? { ...current, ...latest.payload } : current));
  }, [events]);

  const projects = [...new Set(cameras.map((c) => c.project_name).filter(Boolean))];
  const visible = filter === 'all' ? cameras : cameras.filter((c) => c.project_name === filter);

  return (
    <>
      <div className="section-title">
        <h1>Live monitoring</h1>
        <button className="btn btn-ghost btn-sm" type="button" onClick={load}>
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {overview && (
        <div className="stat-grid">
          <div className="stat">
            <div className="stat-value">{overview.online ?? 0}</div>
            <div className="stat-label">Cameras online</div>
          </div>
          <div className="stat">
            <div className="stat-value">{overview.offline ?? 0}</div>
            <div className="stat-label">Offline</div>
          </div>
        </div>
      )}

      {projects.length > 1 && (
        <div className="row">
          <button
            className={`btn btn-sm ${filter === 'all' ? '' : 'btn-ghost'}`}
            type="button"
            onClick={() => setFilter('all')}
          >
            All sites
          </button>
          {projects.map((name) => (
            <button
              key={name}
              className={`btn btn-sm ${filter === name ? '' : 'btn-ghost'}`}
              type="button"
              onClick={() => setFilter(name)}
            >
              {name.length > 18 ? `${name.slice(0, 18)}…` : name}
            </button>
          ))}
        </div>
      )}

      {overview?.alerts?.length > 0 && (
        <div className="card">
          <div className="card-title">Active alerts</div>
          {overview.alerts.slice(0, 4).map((alert, index) => (
            <div className="list-row" key={index}>
              <div className="avatar" style={{ background: alert.severity === 'high' ? '#dc2626' : '#f59e0b' }}>
                {alert.severity === 'high' ? '!' : 'i'}
              </div>
              <div className="grow small">{alert.message}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="center">
          <span className="spinner spinner-dark" />
        </div>
      )}

      {!loading && !visible.length && (
        <div className="card empty">No cameras are registered for this project yet.</div>
      )}

      <div className="camera-grid">
        {visible.map((camera) => (
          <div className="camera-card" key={camera.id}>
            <div className="camera-frame">
              {camera.online ? (
                <img
                  key={tick}
                  src={monitoringAPI.snapshotUrl(camera.id)}
                  alt={`${camera.name} live feed`}
                  onError={(event) => {
                    event.currentTarget.style.visibility = 'hidden';
                  }}
                />
              ) : (
                <div className="shimmer" style={{ width: '100%', height: '100%' }} />
              )}
              <div className="camera-osd">
                <span className={camera.online ? 'rec' : ''}>
                  {camera.online ? '● REC' : '○ NO SIGNAL'}
                </span>
                <span>{clock()}</span>
              </div>
            </div>
            <div className="camera-meta">
              <div className="camera-name truncate">{camera.name}</div>
              <div className="truncate" style={{ opacity: 0.75 }}>
                {camera.project_name || 'Unassigned'}
              </div>
              <div className="row mt" style={{ gap: 6 }}>
                <span className={`chip chip-${camera.online ? 'online' : 'offline'}`}>
                  {camera.online ? 'online' : 'offline'}
                </span>
                <span className="tiny" style={{ opacity: 0.7 }}>
                  {camera.stream_type}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="tiny muted center">
        Frames refresh every {REFRESH_MS / 1000}s. Simulated cameras are generated by the server;
        registered HLS/MJPEG cameras are proxied live.
      </div>
    </>
  );
};

export default Monitoring;
