import React, { useCallback, useEffect, useState } from 'react';
import { vcAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Random video verification.
 *
 * The backend pairs an official with a project at random (so the pairing cannot
 * be arranged in advance) and returns a Jitsi Meet room URL. Jitsi is free, needs
 * no API key, and the room can be embedded directly in the page.
 */
const Meet = () => {
  const { user, isBackOffice } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await vcAPI.sessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load meetings.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startRandom = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await vcAPI.create({ mode: 'random' });
      setActive(data.session);
      setJoined(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start a session.');
    } finally {
      setBusy(false);
    }
  };

  const openSession = async (session) => {
    setActive(session);
    setJoined(false);
    try {
      await vcAPI.logJoin(session.id, 'join');
    } catch (err) {
      /* presence logging is best effort */
    }
  };

  const joinCall = async () => {
    if (!active) return;
    setJoined(true);
    try {
      await vcAPI.logJoin(active.id, 'join');
    } catch (err) {
      /* ignore */
    }
  };

  const endSession = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await vcAPI.end(active.id);
      setActive(null);
      setJoined(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not end the session.');
    } finally {
      setBusy(false);
    }
  };


  return (
    <>
      <div className="section-title">
        <h1>Random verification</h1>
        <button className="btn btn-ghost btn-sm" type="button" onClick={load}>
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-title">Start a random video session</div>
        <div className="small muted mb">
          The system pairs you with a randomly chosen project so the verification cannot be
          pre-arranged. The other party is notified instantly.
        </div>
        <button className="btn" type="button" onClick={startRandom} disabled={busy}>
          {busy ? 'Connecting…' : '🎲 Connect me randomly'}
        </button>
      </div>

      {active && (
        <div className="card">
          <div className="row">
            <div className="grow">
              <div className="card-title">{active.project_name || 'Live review'}</div>
              <div className="small muted">
                Room {active.room_id} · {active.project_location || 'location not set'}
              </div>
            </div>
            <span className={`chip chip-${active.status}`}>{active.status}</span>
          </div>
          <div className="divider" />
          <div className="card-row">
            <span className="muted">Assigned official</span>
            <span>{active.official_name || user?.name}</span>
          </div>
          <div className="card-row">
            <span className="muted">Scheduled</span>
            <span>{active.scheduled_at ? new Date(active.scheduled_at).toLocaleString('en-IN') : '—'}</span>
          </div>

          {joined ? (
            <iframe
              className="meet-frame mt"
              title="Video verification"
              src={active.join_url}
              allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
            />
          ) : (
            <button className="btn btn-green mt" type="button" onClick={joinCall}>
              ▶ Join secure call
            </button>
          )}

          <div className="btn-row mt">
            <a className="btn btn-ghost" href={active.join_url} target="_blank" rel="noreferrer">
              Open in new tab
            </a>
            {isBackOffice && (
              <button className="btn btn-red" type="button" onClick={endSession} disabled={busy}>
                End session
              </button>
            )}
          </div>
          <div className="tiny muted mt">
            Camera and microphone are used only inside the call. If the embedded view is blocked,
            open the room in a new tab.
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Session history</div>
        {!sessions.length && <div className="small muted mt">No sessions yet.</div>}
        {sessions.slice(0, 8).map((session) => (
          <button
            key={session.id}
            type="button"
            className="list-row"
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
            onClick={() => openSession(session)}
          >
            <div className="avatar">🎥</div>
            <div className="grow">
              <div className="truncate" style={{ fontWeight: 600 }}>
                {session.project_name || `Room ${session.room_id}`}
              </div>
              <div className="tiny muted">
                {session.official_name || '—'} ·{' '}
                {session.scheduled_at ? new Date(session.scheduled_at).toLocaleDateString('en-IN') : '—'}
              </div>
            </div>
            <span className={`chip chip-${session.status}`}>{session.status}</span>
          </button>
        ))}
      </div>
    </>
  );
};

export default Meet;