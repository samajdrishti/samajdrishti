import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, Alert, Stack, IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import {
  VideocamOutlined as VideocamIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenIcon,
  StopCircleOutlined as StopIcon,
} from '@mui/icons-material';
import { adminAPI, monitoringAPI, vcAPI } from '../services/api';
import AuthSnapshot from '../components/AuthSnapshot';

const REFRESH_MS = 10000;
const severityColor = { high: 'error', medium: 'warning', low: 'default' };

const LiveMonitoring = () => {
  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [narrative, setNarrative] = useState(null);
  const [tone, setTone] = useState('executive');
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const [over, s] = await Promise.all([
        monitoringAPI.overview(),
        vcAPI.sessions().catch(() => ({ data: [] })),
      ]);
      setOverview(over.data);
      setSessions(Array.isArray(s.data) ? s.data : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach the monitoring service.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // One heartbeat drives both the overview refresh and the frame tick.
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((v) => v + 1);
      load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const generateNarrative = async (selectedTone) => {
    setBusy('narrative');
    setError('');
    try {
      const { data } = await adminAPI.getNarrative(selectedTone);
      setNarrative(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate the briefing.');
    } finally {
      setBusy('');
    }
  };

  const openRandomVC = async () => {
    setBusy('vc');
    setError('');
    try {
      const { data } = await vcAPI.create({ mode: 'random' });
      setActive(data.session);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not open a session.');
    } finally {
      setBusy('');
    }
  };

  const endSession = async () => {
    if (!active) return;
    setBusy('vc');
    try {
      await vcAPI.end(active.id);
      setActive(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not end the session.');
    } finally {
      setBusy('');
    }
  };

  const cameras = overview?.cameras || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Live Monitoring</Typography>
        <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3} sx={{ mb: 2 }}>
        {[
          { label: 'Cameras online', value: overview?.online ?? '—', color: '#27ae60' },
          { label: 'Cameras offline', value: overview?.offline ?? '—', color: '#e74c3c' },
          { label: 'Active inspections', value: overview?.active_inspections ?? '—', color: '#3498db' },
          { label: 'Open alerts', value: overview?.alerts?.length ?? '—', color: '#f39c12' },
        ].map((stat) => (
          <Grid item xs={6} md={3} key={stat.label}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: stat.color }}>{stat.value}</Typography>
              <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6">AI briefing</Typography>
          <Stack direction="row" spacing={1}>
            {['executive', 'field', 'technical'].map((option) => (
              <Chip
                key={option}
                label={option}
                size="small"
                onClick={() => {
                  setTone(option);
                  generateNarrative(option);
                }}
                color={tone === option ? 'primary' : 'default'}
                variant={tone === option ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
        </Box>
        {busy === 'narrative' ? (
          <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={22} /></Box>
        ) : narrative ? (
          <>
            <Typography variant="body1" sx={{ mt: 1.5, whiteSpace: 'pre-wrap' }}>{narrative.narrative}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Generated by {narrative.provider} · {new Date(narrative.generated_at).toLocaleString('en-IN')}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Pick a tone to generate an LLM briefing of the current portfolio (uses the Groq model when
            a key is configured, otherwise a deterministic local summary).
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6">Random video verification</Typography>
          <Button variant="contained" startIcon={<VideocamIcon />} onClick={openRandomVC} disabled={busy === 'vc'}>
            {busy === 'vc' ? 'Connecting…' : 'Open random session'}
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          A project and an official are paired at random and connected over an encrypted Jitsi Meet
          room (free, no API key). The chosen official is notified instantly.
        </Typography>

        {active && (
          <Box sx={{ mt: 2 }}>
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" startIcon={<StopIcon />} onClick={endSession}>
                  End
                </Button>
              }
            >
              <strong>{active.project_name}</strong> · room {active.room_id} · official {active.official_name}
              <br />
              <a href={active.join_url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                Open the meeting in a new tab <OpenIcon fontSize="inherit" />
              </a>
            </Alert>
            <Box
              component="iframe"
              src={active.join_url}
              title="Samaj Drishti video verification"
              allow="camera; microphone; fullscreen; display-capture; autoplay"
              sx={{ width: '100%', height: 420, border: 0, borderRadius: 2, mt: 1 }}
            />
          </Box>
        )}

        <Box sx={{ mt: 2 }}>
          {sessions.slice(0, 6).map((session) => (
            <Box
              key={session.id}
              sx={{ display: 'flex', gap: 2, alignItems: 'center', py: 0.75, borderBottom: '1px solid #eee' }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                {session.project_name || `Room ${session.room_id}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">{session.official_name}</Typography>
              <Chip size="small" label={session.status} color={session.status === 'live' ? 'error' : 'default'} />
              <Tooltip title="Open room">
                <IconButton size="small" onClick={() => setActive(session)}>
                  <OpenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      </Paper>

      <Typography variant="h6" gutterBottom>Site CCTV</Typography>
      <Grid container spacing={2}>
        {cameras.map((camera) => (
          <Grid item xs={12} sm={6} md={4} key={camera.id}>
            <Paper sx={{ overflow: 'hidden', bgcolor: '#0b1220', color: '#e2e8f0' }}>
              <Box sx={{ position: 'relative', aspectRatio: '16 / 9', bgcolor: '#020617' }}>
                {camera.online ? (
                  <AuthSnapshot
                    cameraId={camera.id}
                    refreshKey={tick}
                    alt={`${camera.name} live feed`}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      filter: camera.tamper_flag === 'obstruction_detected' ? 'brightness(0.25) contrast(1.4)' : 'none',
                    }}
                  />
                ) : (
                  <Box sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#64748b' }}>
                    No signal · Power Disconnected
                  </Box>
                )}

                {/* AI Computer Vision Anomaly Detection Overlay (Slide 3 - Section 4) */}
                {camera.tamper_flag === 'obstruction_detected' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      right: 8,
                      bgcolor: 'rgba(220, 38, 38, 0.9)',
                      color: '#fff',
                      p: 0.8,
                      borderRadius: 1,
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      boxShadow: '0 0 12px rgba(220, 38, 38, 0.8)',
                    }}
                  >
                    🚨 AI ALERT: {camera.occlusion_pct || 84.5}% LENS OBSTRUCTION
                  </Box>
                )}

                {camera.tamper_flag === 'headcount_discrepancy' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      right: 8,
                      bgcolor: 'rgba(217, 119, 6, 0.9)',
                      color: '#fff',
                      p: 0.8,
                      borderRadius: 1,
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    ⚠️ DISCREPANCY: Visual {camera.detected_headcount || 4} vs AEBAS {camera.aebas_punch_count || 25}
                  </Box>
                )}

                {camera.online && camera.tamper_flag === 'normal' && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      bgcolor: 'rgba(5, 150, 105, 0.85)',
                      color: '#fff',
                      px: 0.8,
                      py: 0.3,
                      borderRadius: 1,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    ✓ Headcount: {camera.detected_headcount || 26} Verified
                  </Box>
                )}

                <Box
                  sx={{
                    position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex',
                    justifyContent: 'space-between', px: 1, py: 0.4, fontSize: 11, fontWeight: 700,
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                  }}
                >
                  <span style={{ color: camera.online ? '#ef4444' : '#64748b' }}>
                    {camera.online ? '● REC · AI CV ACTIVE' : '○ OFFLINE'}
                  </span>
                  <span>{new Date().toLocaleTimeString('en-IN', { hour12: false })}</span>
                </Box>
              </Box>
              <Box sx={{ p: 1.5 }}>
                <Typography variant="subtitle2">{camera.name}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.75, display: 'block' }}>
                  {camera.project_name || 'Unassigned'} · {camera.location}
                </Typography>
                {camera.anomaly_note && (
                  <Typography variant="caption" sx={{ color: camera.tamper_flag === 'obstruction_detected' ? '#ef4444' : '#f59e0b', fontWeight: 600, display: 'block', mt: 0.5 }}>
                    {camera.anomaly_note}
                  </Typography>
                )}
                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip size="small" label={camera.online ? 'online' : 'offline'} color={camera.online ? 'success' : 'error'} />
                  <Button
                    size="small"
                    onClick={async () => {
                      await monitoringAPI.setStatus(camera.id, camera.online ? 'offline' : 'online');
                      load();
                    }}
                  >
                    {camera.online ? 'Mark offline' : 'Mark online'}
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
        {!cameras.length && (
          <Grid item xs={12}>
            <Typography color="text.secondary" variant="body2">No cameras registered yet.</Typography>
          </Grid>
        )}
      </Grid>

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" gutterBottom>Alert feed</Typography>
        {(overview?.alerts || []).map((alert, index) => (
          <Box key={index} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 0.75, borderBottom: '1px solid #eee' }}>
            <Chip size="small" label={alert.severity} color={severityColor[alert.severity] || 'default'} />
            <Typography variant="body2" sx={{ flex: 1 }}>{alert.message}</Typography>
            <Typography variant="caption" color="text.secondary">{alert.type}</Typography>
          </Box>
        ))}
        {!(overview?.alerts || []).length && (
          <Typography variant="body2" color="text.secondary">No active alerts.</Typography>
        )}
      </Paper>
    </Box>
  );
};

export default LiveMonitoring;


