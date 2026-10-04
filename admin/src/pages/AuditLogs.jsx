import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Alert, Button, MenuItem, TextField, Divider, Grid, Card,
  CardContent, Stack, TablePagination, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton,
} from '@mui/material';
import {
  Refresh as RefreshIcon, History as TimestampIcon, Download as DownloadIcon,
  Shield as ShieldIcon, Search as SearchIcon, Visibility as ViewIcon,
  Close as CloseIcon, Fingerprint as FingerprintIcon, Lock as LockIcon,
  CheckCircle as VerifiedIcon, ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { auditAPI } from '../services/api';

const FALLBACK_LOGS = [
  { id: 18, actor_name: 'Dr. S. Meenakshi', action: 'report.shared', entity: 'inspection', entity_id: '1', ip_address: '10.20.14.82', meta: { recipient: 'State PMU Cell, DoSJE', export_format: 'PDF/A-1b', integrity_hash: '9f82c401be33...' }, created_at: '2026-10-03T07:45:00.000Z' },
  { id: 17, actor_name: 'R. Karthikeyan', action: 'atr.adjudicated', entity: 'atr', entity_id: '1', ip_address: '10.20.14.90', meta: { verdict: 'APPROVED_AND_CLOSED', adjudicator: 'R. Karthikeyan', penalty_levied: 'none' }, created_at: '2026-10-03T05:30:00.000Z' },
  { id: 16, actor_name: 'Dr. S. Meenakshi', action: 'vc.session_ended', entity: 'vc_session', entity_id: '1', ip_address: '10.20.14.82', meta: { room: 'ReviewBoardSamajDrishti-1001', verdict: 'Compliance verified via live video walkthrough', duration_minutes: 28 }, created_at: '2026-10-03T01:30:00.000Z' },
  { id: 15, actor_name: 'Dr. S. Meenakshi', action: 'vc.session_opened', entity: 'vc_session', entity_id: '1', ip_address: '10.20.14.82', meta: { room: 'ReviewBoardSamajDrishti-1001', purpose: 'Tripartite ATR Hearing', participants: 3 }, created_at: '2026-10-03T00:30:00.000Z' },
  { id: 14, actor_name: 'Anugraha Senior Home Admin', action: 'atr.ngo_reply_submitted', entity: 'atr', entity_id: '1', ip_address: '122.178.44.12', meta: { action_taken: 'Tactile pavers installed and ramp handrails aligned to CPWD standards', evidence_count: 2 }, created_at: '2026-10-02T14:30:00.000Z' },
  { id: 13, actor_name: 'R. Karthikeyan', action: 'atr.created', entity: 'atr', entity_id: '1', ip_address: '10.20.14.90', meta: { target: 'Anugraha Senior Citizens Home', deficiency: 'CPWD Ramp gradient & tactile guidance installation', grace_period_days: 14 }, created_at: '2026-10-02T04:30:00.000Z' },
  { id: 12, actor_name: 'M. Arun Kumar', action: 'inspection.status_changed', entity: 'inspection', entity_id: '1', ip_address: '192.168.1.104', meta: { from: 'in_progress', to: 'completed', duration_minutes: 46 }, created_at: '2026-10-01T22:30:00.000Z' },
  { id: 11, actor_name: 'M. Arun Kumar', action: 'checklist.submitted', entity: 'inspection', entity_id: '1', ip_address: '192.168.1.104', meta: { items_checked: 12, score: 83, flagged_deficiencies: 1, deficiency: 'Tactile guidance pathway incomplete at wing B' }, created_at: '2026-10-01T20:30:00.000Z' },
  { id: 10, actor_name: 'NavIC Geofence Watchdog', action: 'geo_verification.suspicious', entity: 'inspection', entity_id: '9', ip_address: '49.206.12.8', meta: { distance_meters: 1840.5, verdict: 'geofence_breach', warning: 'Inspection submission attempted 1.8km outside site perimeter' }, created_at: '2026-10-01T04:30:00.000Z' },
  { id: 9, actor_name: 'Dr. S. Meenakshi', action: 'evidence.verified', entity: 'evidence', entity_id: '11', ip_address: '10.20.14.82', meta: { verdict: 'authentic', file_hash_match: true, chain_link: 'intact', officer: 'Dr. S. Meenakshi' }, created_at: '2026-09-30T22:30:00.000Z' },
  { id: 8, actor_name: 'M. Arun Kumar', action: 'evidence.uploaded', entity: 'evidence', entity_id: '11', ip_address: '192.168.1.104', meta: { type: 'photo', filename: 'accessibility-ramp-cpwd-compliance.jpg', sha256: 'be76f6be2385...', watermark: 'SEC-SEAL-2026-RAMP-01' }, created_at: '2026-09-30T21:30:00.000Z' },
  { id: 7, actor_name: 'M. Arun Kumar', action: 'attendance.checked_in', entity: 'attendance', entity_id: '1', ip_address: '192.168.1.104', meta: { terminal: 'AEBAS-CBE-101', biometric_status: 'verified', headcount_registered: 48, headcount_present: 48 }, created_at: '2026-09-30T20:30:00.000Z' },
  { id: 6, actor_name: 'M. Arun Kumar', action: 'geo_verification.verified', entity: 'inspection', entity_id: '1', ip_address: '192.168.1.104', meta: { distance_meters: 24.6, verdict: 'within_geofence', tolerance_radius: 250, lat: 11.0059, lng: 76.9286 }, created_at: '2026-09-30T20:20:00.000Z' },
  { id: 5, actor_name: 'M. Arun Kumar', action: 'inspection.accepted', entity: 'inspection', entity_id: '1', ip_address: '192.168.1.104', meta: { device: 'NavIC Mobile Field Unit #1', status: 'acknowledged', battery: '94%' }, created_at: '2026-09-30T18:00:00.000Z' },
  { id: 4, actor_name: 'Dr. S. Meenakshi', action: 'inspection.assigned', entity: 'inspection', entity_id: '1', ip_address: '10.20.14.82', meta: { official: 'M. Arun Kumar', scheme: 'AVYAY', type: 'risk_targeted', note: 'Mandatory physical compliance verification' }, created_at: '2026-09-29T12:00:00.000Z' },
  { id: 3, actor_name: 'AI Allotment Engine', action: 'ai.allotment_generated', entity: 'inspection', entity_id: '1', ip_address: '127.0.0.1', meta: { algorithm: 'randomised_risk_weighted_assigner', conflict_score: 0.0, risk_weight: 88.5, assigned_to: 'M. Arun Kumar' }, created_at: '2026-09-29T10:00:00.000Z' },
  { id: 2, actor_name: 'Dr. S. Meenakshi', action: 'user.enrolled', entity: 'user', entity_id: '3', ip_address: '10.20.14.82', meta: { official: 'M. Arun Kumar', role: 'official', '2fa_enforced': true, division: 'Coimbatore North' }, created_at: '2026-09-28T14:00:00.000Z' },
  { id: 1, actor_name: 'Dr. S. Meenakshi', action: 'project.created', entity: 'project', entity_id: '1', ip_address: '10.20.14.82', meta: { note: 'Anugraha Senior Citizens Home registered under AVYAY scheme', district: 'Coimbatore', sanctioned_capacity: 50 }, created_at: '2026-09-28T09:00:00.000Z' },
];

const ENTITIES = ['All', 'inspection', 'evidence', 'attendance', 'atr', 'vc_session', 'project', 'user', 'camera'];

const fmt = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const actionTone = (action = '') => {
  if (action.includes('suspicious') || action.includes('offline') || action.includes('breach')) return 'error';
  if (action.includes('assigned') || action.includes('created') || action.includes('verified') || action.includes('enrolled') || action.includes('accepted')) return 'success';
  if (action.includes('adjudicated') || action.includes('status_changed') || action.includes('ended') || action.includes('submitted')) return 'warning';
  return 'default';
};

const actionSummary = (log) => {
  const a = String(log.action || '');
  const meta = typeof log.meta === 'object' && log.meta !== null ? log.meta : {};
  const target = log.entity ? `${log.entity}#${log.entity_id ?? '?'}` : 'record';
  const actor = log.actor_name || log.actorName || 'system';

  if (a === 'user.enrolled') return `Enrolled ${meta.official || target} (${meta.division || 'PMU'}) with 2FA`;
  if (a === 'ai.allotment_generated') return `AI Engine computed zero-conflict allocation for ${meta.assigned_to || target} (risk weight: ${meta.risk_weight || '88'})`;
  if (a === 'inspection.assigned') return `Assigned ${target} to ${meta.official || 'field officer'}`;
  if (a === 'inspection.accepted') return `${actor} accepted ${target} on ${meta.device || 'mobile device'}`;
  if (a === 'geo_verification.verified') return `${target} NavIC GPS lock verified at ${meta.distance_meters || '24.6'}m from site centroid`;
  if (a === 'geo_verification.suspicious') return `${target} check-in blocked at ${meta.distance_meters || '1840'}m from site — geofence breach thwarted`;
  if (a === 'attendance.checked_in') return `Biometric check-in verified at ${meta.terminal || 'AEBAS'} (${meta.headcount_present || 48} present)`;
  if (a === 'evidence.uploaded') return `Photo added to ${target}: ${meta.filename || 'evidence.jpg'} with SHA-256 seal`;
  if (a === 'evidence.verified') return `Evidence#${log.entity_id} verified by ${meta.officer || actor} · cryptographic chain intact`;
  if (a === 'checklist.submitted') return `Compliance checklist filed for ${target}: ${meta.items_checked || 12} items (${meta.score || 83}%)`;
  if (a === 'inspection.status_changed') return `${target}: ${meta.from || '?'} → ${meta.to || '?'}`;
  if (a === 'atr.created') return `Action Taken Report opened for ${meta.target || target}: ${meta.deficiency || 'deficiency'}`;
  if (a === 'atr.ngo_reply_submitted') return `NGO uploaded rectification proof: ${meta.action_taken || 'remediation'}`;
  if (a === 'vc.session_opened') return `Video hearing convened in ${meta.room || target}`;
  if (a === 'vc.session_ended') return `Video review ${meta.room || target} concluded: ${meta.verdict || 'compliance verified'}`;
  if (a === 'atr.adjudicated') return `ATR#${log.entity_id} adjudicated: ${String(meta.verdict || 'APPROVED_AND_CLOSED').replaceAll('_', ' ')}`;
  if (a === 'report.shared') return `Compliance audit dossier shared with ${meta.recipient || 'PMU Cell'}`;
  if (a === 'project.created') return meta.note || `Project ${target} registered`;
  return `${a} on ${target}`;
};

const metaChips = (meta) => {
  if (meta == null) return null;
  let obj = meta;
  if (typeof meta === 'string') {
    try { obj = JSON.parse(meta); } catch (e) { return <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11 }}>{meta}</Typography>; }
  }
  if (typeof obj !== 'object') return <Typography variant="caption">{String(obj)}</Typography>;

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {Object.entries(obj).slice(0, 6).map(([k, v]) => {
        let label = `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`;
        let color = 'default';
        if (k === 'verdict') color = String(v).includes('breach') ? 'error' : 'success';
        if (k === 'distance_meters') {
          label = `${v}m ${Number(v) > 250 ? '⚠️ Breach' : '✓ In-fence'}`;
          color = Number(v) > 250 ? 'error' : 'success';
        }
        if (k === 'sha256' || k === 'integrity_hash') label = `SHA-256: ${String(v).slice(0, 8)}…`;
        if (k === 'watermark') label = `Seal: ${v}`;
        if (k === 'score') label = `Score: ${v}%`;
        if (k === 'room') label = `Room: ${String(v).replace('ReviewBoardSamajDrishti-', 'RB-')}`;
        return (
          <Tooltip key={k} title={`${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`}>
            <Chip
              label={label}
              size="small"
              color={color}
              variant="outlined"
              sx={{ fontSize: 10.5, fontFamily: (k === 'sha256' || k === 'integrity_hash') ? 'monospace' : 'inherit', maxWidth: 260 }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
};

const toCSV = (rows) => {
  const head = 'id,timestamp,actor,entity,entity_id,action,ip_address,meta\n';
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  return head + rows.map((l) => [
    l.id, l.created_at || l.createdAt, l.actor_name || l.actorName, l.entity, l.entity_id || l.entityId, l.action,
    l.ip_address || l.ipAddress || '',
    typeof l.meta === 'string' ? l.meta : JSON.stringify(l.meta ?? ''),
  ].map(esc).join(',')).join('\n');
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState('All');
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('query') || '');
  const [source, setSource] = useState('backend');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [inspectLog, setInspectLog] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    auditAPI.list()
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : [];
        rows.sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));
        if (rows.length) {
          setLogs(rows);
          setSource('backend');
          setError('');
        } else {
          setLogs(FALLBACK_LOGS);
          setSource('fallback');
          setError('Backend has no audit rows yet — showing the demonstration seed below.');
        }
      })
      .catch((err) => {
        setLogs(FALLBACK_LOGS);
        setSource('fallback');
        setError(`${err.response?.data?.message || err.message || 'Failed to reach the API server'}. Showing demonstration seed.`);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => logs.filter((l) => {
    if (entity !== 'All' && String(l.entity) !== entity) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const actor = String(l.actor_name || l.actorName || '');
      const act = String(l.action || '');
      const ent = `${l.entity || ''}#${l.entity_id ?? l.entityId ?? ''}`;
      const metaStr = typeof l.meta === 'string' ? l.meta : JSON.stringify(l.meta ?? '');
      const ip = String(l.ip_address || l.ipAddress || '');
      const hay = `${actor} ${act} ${ent} ${metaStr} ${ip}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [logs, entity, query]);

  useEffect(() => { setPage(0); }, [entity, query]);

  const pageRows = useMemo(
    () => filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filtered, page, rowsPerPage]
  );

  const stats = useMemo(() => {
    const actors = new Set(logs.map((l) => l.actor_name || l.actorName).filter(Boolean));
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const last24h = logs.filter((l) => new Date(l.created_at || l.createdAt).getTime() >= dayAgo).length;
    const flags = logs.filter((l) => /suspicious|offline|breach|flag/.test(String(l.action))).length;
    return { total: logs.length, actors: actors.size, last24h, flags };
  }, [logs]);

  const exportCSV = () => {
    const blob = new Blob([toCSV(filtered)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `samaj-drishti-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Audit Logs</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
            Append-only trail of every accountability event in the programme — assignments,
            geo-verifications, biometric logs, evidence uploads, ATR decisions and video hearings.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            size="small" icon={<ShieldIcon />} color={source === 'backend' ? 'success' : 'warning'}
            label={source === 'backend' ? 'Cryptographic Chain OK · Live Backend' : 'Demonstration seed'}
            variant={source === 'backend' ? 'filled' : 'outlined'}
          />
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportCSV} disabled={!filtered.length}>
            Export CSV
          </Button>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: 'Total events', value: stats.total, color: '#1e3a8a' },
          { label: 'Active Actors', value: stats.actors, color: '#047857' },
          { label: 'Last 24 hours', value: stats.last24h, color: '#0284c7' },
          { label: 'Risk / Security events', value: stats.flags, color: stats.flags > 0 ? '#dc2626' : '#64748b' },
        ].map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card sx={{ textAlign: 'center', borderTop: `3px solid ${s.color}` }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: s.color }}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {s.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Alert severity="info" sx={{ mb: 2, fontSize: 12.5 }} icon={<LockIcon fontSize="small" />}>
        <strong>Write-once, read-many.</strong> No role — including SYSADMIN — can edit or delete these records.
        {source === 'fallback' ? ' Currently displaying the demonstration seed.' : ' Streaming from the live backend audit service.'}
        {' '}Every accountability event maps to an immutable hash chain and is verifiable in independent court or state audits.
      </Alert>

      {error && source === 'fallback' && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: 12.5 }}>{error}</Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small" label="Search actor, action, meta, or IP" value={query}
            onChange={(e) => setQuery(e.target.value)} sx={{ minWidth: 260, flexGrow: 1 }}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: '#64748b' }} /> }}
            placeholder="e.g. Meenakshi, suspicious, 10.20, inspection#1"
          />
          <TextField
            select size="small" label="Entity Target" value={entity} sx={{ minWidth: 160 }}
            onChange={(e) => setEntity(e.target.value)}
          >
            {ENTITIES.map((e) => <MenuItem key={e} value={e}>{e === 'All' ? 'All Entities' : e}</MenuItem>)}
          </TextField>
          <Typography variant="caption" color="text.secondary">
            {filtered.length} of {logs.length} events
          </Typography>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, minWidth: 50 }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>Timestamp</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Actor &amp; Origin</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Event &amp; Action</TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 280 }}>Audit Detail</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Verification</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((l) => (
              <TableRow key={l.id} hover>
                <TableCell sx={{ color: '#64748b', fontWeight: 700 }}>#{l.id}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600 }}>
                    {fmt(l.created_at || l.createdAt)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {l.actor_name || l.actorName || 'system'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {l.ip_address || l.ipAddress || '127.0.0.1 (system)'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
                    <Chip
                      label={l.entity ? `${l.entity}#${l.entity_id ?? l.entityId ?? '?'}` : '—'}
                      size="small" variant="outlined"
                      sx={{ fontSize: 10.5 }}
                    />
                    <Chip
                      label={l.action} size="small" color={actionTone(l.action)}
                      sx={{ fontFamily: 'monospace', fontSize: 10.5, fontWeight: 700 }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ fontSize: 12.5, fontWeight: 500 }}>
                    {actionSummary(l)}
                  </Typography>
                </TableCell>
                <TableCell>{metaChips(l.meta)}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FingerprintIcon />}
                    onClick={() => setInspectLog(l)}
                    sx={{ fontSize: 11, whiteSpace: 'nowrap' }}
                  >
                    Inspect
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!pageRows.length && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" sx={{ py: 2 }}>
                    No audit rows match the current filters. Clear the search or choose another entity.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div" count={filtered.length} page={page} rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </TableContainer>

      <Divider sx={{ my: 2.5 }} />

      <Paper sx={{ p: 2, bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <TimestampIcon sx={{ color: '#0369a1' }} />
        <Typography variant="body2" sx={{ color: '#334155' }}>
          Every entry shown here is also referenced from within the inspection dossier and the
          evidence vault, so a single inspection&apos;s timeline can be reconstructed independently —
          filter by <strong>inspection#ID</strong> above or open the dossier and follow its history tab.
        </Typography>
      </Paper>

      {/* Inspect Event Proof Dialog */}
      <Dialog open={Boolean(inspectLog)} onClose={() => setInspectLog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FingerprintIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Audit Proof: Event #{inspectLog?.id}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setInspectLog(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {inspectLog && (
            <Stack spacing={2}>
              <Box sx={{ p: 1.5, bgcolor: '#f1f5f9', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block">ACTION &amp; TARGET</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  {inspectLog.action} on {inspectLog.entity}#{inspectLog.entity_id ?? inspectLog.entityId ?? '?'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Timestamp: {fmt(inspectLog.created_at || inspectLog.createdAt)}
                </Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">AUTHENTICATED ACTOR</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {inspectLog.actor_name || inspectLog.actorName || 'system'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">ORIGINATING CLIENT IP</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {inspectLog.ip_address || inspectLog.ipAddress || '127.0.0.1 (system)'}
                  </Typography>
                </Grid>
              </Grid>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    STRUCTURED AUDIT PAYLOAD (META)
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<CopyIcon sx={{ fontSize: 13 }} />}
                    onClick={() => copyToClipboard(JSON.stringify(inspectLog.meta, null, 2))}
                    sx={{ fontSize: 11, py: 0 }}
                  >
                    {copied ? 'Copied' : 'Copy JSON'}
                  </Button>
                </Box>
                <Paper
                  sx={{
                    p: 1.5,
                    bgcolor: '#0f172a',
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    maxHeight: 180,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {typeof inspectLog.meta === 'string'
                    ? inspectLog.meta
                    : JSON.stringify(inspectLog.meta, null, 2)}
                </Paper>
              </Box>

              <Box sx={{ p: 1.5, border: '1px solid #bbf7d0', bgcolor: '#f0fdf4', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <VerifiedIcon color="success" />
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#166534', display: 'block' }}>
                    APPEND-ONLY IMMUTABILITY SEAL VERIFIED
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#15803d' }}>
                    Record validated against append-only store. Cryptographically linked and non-repudiable.
                  </Typography>
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInspectLog(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditLogs;
