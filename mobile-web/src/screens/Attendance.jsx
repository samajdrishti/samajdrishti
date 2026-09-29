import React, { useCallback, useEffect, useState } from 'react';
import { attendanceAPI, inspectionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCoords, getPosition } from '../services/geo';
import { flushQueue, pendingCounts } from '../services/offlineQueue';

const timeOf = (value) =>
  value ? new Date(value).toLocaleTimeString('en-IN', { hour12: false }) : '—';

const Attendance = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [coords, setCoords] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(pendingCounts());

  const load = useCallback(async () => {
    try {
      const [history, mine] = await Promise.all([
        attendanceAPI.history(user?.id).catch(() => ({ data: [] })),
        inspectionAPI.mine().catch(() => ({ data: [] })),
      ]);
      setRecords(Array.isArray(history.data) ? history.data : []);
      const unique = [...new Map((mine.data || []).map((i) => [i.project_id, i.project_name])).entries()];
      setProjects(unique.filter(([id]) => id));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load attendance.');
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = records.filter((r) => r.date === today);
  const openPunch = todayRecords.find((r) => r.check_in && !r.check_out);
  const checkedIn = todayRecords.some((r) => r.check_in);
  const project = projects.find(([id]) => String(id) === String(projectId));

  const punch = async (action) => {
    setBusy(true);
    setError('');
    setMessage('');
    const position = await getPosition();
    setCoords(position);
    if (!position) {
      setError('GPS is required for attendance. Enable location access and try again.');
      setBusy(false);
      return;
    }
    const payload = {
      project_id: projectId ? Number(projectId) : null,
      lat: position.lat,
      lng: position.lng,
      device: navigator.userAgent.slice(0, 80),
      mode: 'gps',
    };
    try {
      const call = action === 'check_in' ? attendanceAPI.checkIn(payload) : attendanceAPI.checkOut(payload);
      const { data } = await call;
      setMessage(
        action === 'check_in'
          ? `Checked in at ${timeOf(data.check_in)}${data.project_name ? ` · ${data.project_name}` : ''}`
          : `Checked out at ${timeOf(data.check_out)}`
      );
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Attendance could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    try {
      const result = await flushQueue();
      setPending(pendingCounts());
      setMessage(
        `Sync complete — evidence ${result.evidence.synced}/${result.evidence.synced + result.evidence.failed}, ` +
          `status updates ${result.inspections.synced}/${result.inspections.synced + result.inspections.failed}`
      );
      load();
    } catch (err) {
      setError('Sync failed — queued items remain on the device.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="section-title">
        <h1>Attendance</h1>
        <button className="btn btn-ghost btn-sm" type="button" onClick={load}>
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="card">
        <div className="card-title">Today · {today}</div>
        <div className="card-row">
          <span className="muted">Current GPS</span>
          <span className="tiny">{formatCoords(coords)}</span>
        </div>
        <div className="card-row">
          <span className="muted">Status</span>
          <span>
            {openPunch ? `On duty since ${timeOf(openPunch.check_in)}` : checkedIn ? 'Day complete' : 'Not checked in'}
          </span>
        </div>
        {project && (
          <div className="card-row">
            <span className="muted">Site</span>
            <span className="truncate">{project[1]}</span>
          </div>
        )}

        <label className="field mt">
          <span className="field-label">Site for this punch (optional)</span>
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">No specific site</option>
            {projects.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>

        {openPunch ? (
          <button className="btn btn-red" type="button" onClick={() => punch('check_out')} disabled={busy}>
            {busy ? 'Recording…' : '🕕 Check out'}
          </button>
        ) : (
          <button className="btn btn-green" type="button" onClick={() => punch('check_in')} disabled={busy}>
            {busy ? 'Recording…' : '🕘 Check in'}
          </button>
        )}
        <div className="tiny muted mt">
          Check-ins are geo-fenced: punching in far from the selected site is rejected, which is how
          proxy attendance is prevented.
        </div>
      </div>

      {pending.total > 0 && (
        <div className="card">
          <div className="row">
            <div className="grow">
              <div className="card-title">{pending.total} offline item(s)</div>
              <div className="small muted">Queued evidence and status updates awaiting upload.</div>
            </div>
            <button className="btn btn-amber btn-sm" type="button" onClick={syncNow} disabled={busy}>
              Sync
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Recent punches</div>
        {!records.length && <div className="small muted mt">No attendance recorded yet.</div>}
        {records.slice(0, 12).map((record) => (
          <div className="list-row" key={record.id}>
            <div className="avatar">{record.check_in && !record.check_out ? '🟢' : '⚪'}</div>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{record.date}</div>
              <div className="tiny muted truncate">
                {timeOf(record.check_in)} → {timeOf(record.check_out)}
                {record.project_name ? ` · ${record.project_name}` : ''}
              </div>
            </div>
            {record.geo_coords ? (
              <span className="chip chip-verified">geo</span>
            ) : (
              <span className="chip chip-unknown">no geo</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
};

export default Attendance;
