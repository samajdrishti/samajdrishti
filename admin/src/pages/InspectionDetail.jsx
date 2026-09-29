import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Chip, Alert, Button, Divider, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress,
  Stepper, Step, StepLabel, Skeleton,
} from '@mui/material';
import {
  ArrowBack as BackIcon, Business as BusinessIcon, Assignment as AssignmentIcon,
  PhotoCamera as EvidenceIcon, Assessment as ScoreIcon, Security as ShieldIcon,
  VerifiedUser as VerifiedIcon, Warning as WarningIcon, NoteAlt as NotesIcon,
  History as TimelineIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { adminAPI, auditAPI } from '../services/api';

const statusColors = { pending: 'warning', in_progress: 'info', completed: 'success', flagged: 'error' };
const statusHex = { pending: '#f39c12', in_progress: '#3498db', completed: '#27ae60', flagged: '#e74c3c' };
const riskColor = (score) => (score > 70 ? 'error' : score >= 40 ? 'warning' : 'success');
const riskHex = (score) => (score > 70 ? '#e74c3c' : score >= 40 ? '#f39c12' : '#27ae60');
const riskLabel = (score) => (score > 70 ? 'High' : score >= 40 ? 'Medium' : 'Low');

const fmt = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
};

const typeLabel = (type) => String(type == null ? 'photo' : type).toUpperCase();

const InspectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [inspection, setInspection] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [checklist, setChecklist] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.allSettled([
      adminAPI.getInspectionById(id),
      adminAPI.getEvidence(id),
      adminAPI.getInspectionChecklist(id),
      auditAPI.list({ entity: 'inspection', entity_id: id, limit: 200 }),
      adminAPI.getAIInsights(),
    ])
      .then(([insp, ev, cl, au, ai]) => {
        if (insp.status === 'rejected') throw new Error(insp.reason?.response?.data?.message || insp.reason?.message || 'Inspection not found');
        setInspection(insp.value.data);
        setEvidence(ev.status === 'fulfilled' ? ev.value.data : []);
        setChecklist(cl.status === 'fulfilled' ? cl.value.data : null);
        setAuditRows(au.status === 'fulfilled' ? au.value.data : []);
        if (ai.status === 'fulfilled') {
          const list = (ai.value.data && ai.value.data.anomalies) || [];
          setAnomalies(list.filter((a) => String(a.inspection_id ?? a.inspectionId ?? a?.inspection?.id ?? '') === String(id)));
        }
      })
      .catch((err) => setError(err.message || 'Failed to load the inspection dossier'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton variant="text" width={320} height={40} />
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {[0, 1, 2].map((i) => <Grid item xs={12} sm={4} key={i}><Skeleton variant="rounded" height={96} /></Grid>)}
        </Grid>
        <Skeleton variant="rounded" height={220} sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (error || !inspection) {
    return (
      <Box sx={{ p: 3 }}>
        <Button size="small" startIcon={<BackIcon />} onClick={() => navigate('/inspections')}>Back to Inspections</Button>
        <Alert severity="error" sx={{ mt: 2, mb: 2 }}>{error || 'Inspection not found'}</Alert>
      </Box>
    );
  }

  const savedChecks = (checklist && checklist.saved_checks) || {};
  const doneChecks = checklist ? checklist.items.filter((it) => savedChecks[it.id]).length : 0;
  const compliance = checklist && checklist.compliance_score;
  const geoEvents = auditRows.filter((r) => String(r.action).startsWith('geo_verification'));
  const lastGeo = geoEvents[geoEvents.length - 1];
  const statusMarked = auditRows.find((r) => r.action === 'inspection.status_changed');

  const timeline = [
    { label: 'Assigned', done: true, date: inspection.scheduled_date, tone: '#64748b' },
    {
      label: 'Geo-verified',
      done: lastGeo && !String(lastGeo.action).endsWith('suspicious'),
      date: lastGeo ? lastGeo.created_at : null,
      tone: lastGeo && !String(lastGeo.action).endsWith('suspicious') ? '#059669' : '#e74c3c',
    },
    { label: 'In progress', done: ['in_progress', 'completed', 'flagged'].includes(inspection.status), date: statusMarked ? statusMarked.created_at : null, tone: '#2563eb' },
    { label: inspection.status === 'flagged' ? 'Flagged' : 'Completed', done: ['completed', 'flagged'].includes(inspection.status), date: inspection.completed_date, tone: inspection.status === 'flagged' ? '#e74c3c' : '#27ae60' },
  ];

  const statCards = [
    {
      title: 'Compliance Score',
      value: compliance != null ? `${compliance}%` : '—',
      icon: <ScoreIcon />,
      sub: compliance != null ? `${doneChecks}/${checklist.items.length} checks · ${(checklist.scheme || '').toUpperCase()}` : 'Checklist not submitted',
      color: compliance != null ? (compliance >= 80 ? '#27ae60' : compliance >= 60 ? '#f39c12' : '#e74c3c') : '#64748b',
    },
    {
      title: 'Evidence Items',
      value: evidence.length,
      icon: <EvidenceIcon />,
      sub: `${evidence.filter((e) => e.verified).length} verified · ${evidence.filter((e) => !e.verified).length} pending`,
      color: '#0369a1',
    },
    {
      title: 'AI Risk Score',
      value: inspection.ai_risk_score != null ? inspection.ai_risk_score : '—',
      icon: <WarningIcon />,
      sub: inspection.ai_risk_score != null ? `${riskLabel(inspection.ai_risk_score)} risk · human review required` : 'Not scored',
      color: riskHex(inspection.ai_risk_score ?? 50),
    },
    {
      title: 'Officer',
      value: '1',
      icon: <VerifiedIcon />,
      sub: inspection.official_name || 'Unassigned',
      color: '#7c3aed',
    },
  ];

  return (
    <Box>
      <Button size="small" startIcon={<BackIcon />} onClick={() => navigate('/inspections')} sx={{ mb: 1.5, textTransform: 'none' }}>
        Back to Field Inspections
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Inspection #{inspection.id}
            </Typography>
            <Chip label={String(inspection.status).replace('_', ' ')} color={statusColors[inspection.status] || 'default'} sx={{ textTransform: 'capitalize' }} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {inspection.project_name || `Facility #${inspection.project_id}`} · {inspection.location || ''}
          </Typography>
        </Box>
        <Stack2>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
          <Button size="small" variant="outlined" startIcon={<BusinessIcon />} onClick={() => navigate('/projects')}>Facility</Button>
        </Stack2>
      </Box>

      {anomalies.length === 0 && inspection.status === 'flagged' && (
        <Alert severity="error" sx={{ mb: 2, fontSize: 12.5 }}>
          <strong>Flagged inspection.</strong> The officer\u2019s findings below were used to raise an actionable deficiency and a Digital ATR.
        </Alert>
      )}

      {/* Status timeline */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimelineIcon sx={{ fontSize: 18, color: '#0369a1' }} /> Verification life-cycle
        </Typography>
        <Stepper activeStep={timeline.filter((t) => t.done).length - 1} alternativeLabel>
          {timeline.map((t) => (
            <Step key={t.label} completed={t.done}>
              <StepLabel
                StepIconProps={{ style: { color: t.done ? t.tone : null } }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{t.label}</Typography>
                <Typography variant="caption" color="text.secondary">{fmt(t.date)}</Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((c) => (
          <Grid item xs={12} sm={6} md={3} key={c.title}>
            <Paper sx={{ p: 2, borderTop: `3px solid ${c.color}`, height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: '#475569' }}>
                  {c.title}
                </Typography>
                {c.icon}
              </Box>
              <Typography sx={{ fontSize: 30, fontWeight: 800, color: c.color, lineHeight: 1.2, my: 0.5 }}>{c.value}</Typography>
              <Typography variant="caption" color="text.secondary">{c.sub}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Checklist + notes */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Verification Checklist
            </Typography>
            {checklist ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">{checklist.items.length} items · {checklist.scheme}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: riskHex(compliance ?? 50) }}>{compliance != null ? `Compliance ${compliance}%` : 'Not scored'}</Typography>
                </Box>
                {compliance != null && (
                  <LinearProgress
                    variant="determinate"
                    value={compliance}
                    sx={{ height: 8, borderRadius: 4, mb: 2, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: riskHex(compliance) } }}
                  />
                )}
                {checklist.items.map((it) => {
                  const ok = savedChecks[it.id];
                  return (
                    <Box key={it.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, borderBottom: '1px solid #f1f5f9' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{it.title}</Typography>
                        <Typography variant="caption" color="text.secondary">weight {it.weight}%</Typography>
                      </Box>
                      <Chip label={ok ? 'PASS' : 'FAIL'} size="small" color={ok ? 'success' : 'error'} sx={{ fontSize: 10.5, fontWeight: 800 }} />
                    </Box>
                  );
                })}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">No checklist recorded for this inspection.</Typography>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotesIcon sx={{ fontSize: 20, color: '#475569' }} /> Officer Findings &amp; Notes
            </Typography>
            {inspection.notes ? (
              <Typography variant="body2" sx={{ color: '#334155', whiteSpace: 'pre-wrap' }}>{inspection.notes}</Typography>
            ) : (
              <Alert severity="info" sx={{ fontSize: 12.5 }}>No officer notes recorded for this inspection yet.</Alert>
            )}
          </Paper>
        </Grid>

        {/* Evidence + audit */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Tamper-Evidence Vault
              </Typography>
              <Chip icon={<ShieldIcon sx={{ fontSize: 14 }} />} label="TEE · immutble hash" size="small" variant="outlined" sx={{ fontSize: 10.5 }} />
            </Box>
            {evidence.length ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Captured</TableCell>
                      <TableCell>Geo</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {evidence.map((e) => (
                      <TableRow key={e.id} hover>
                        <TableCell>
                          <Chip label={typeLabel(e.type)} size="small" sx={{ fontSize: 10.5, fontWeight: 700 }} />
                        </TableCell>
                        <TableCell>{fmt(e.timestamp || e.created_at)}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                          {e.geo_coords && e.geo_coords.lat != null ? `${Number(e.geo_coords.lat).toFixed(4)}, ${Number(e.geo_coords.lng).toFixed(4)}` : '—'}
                        </TableCell>
                        <TableCell>
                          <Chip label={e.verified ? 'VERIFIED' : 'PENDING'} size="small" color={e.verified ? 'success' : 'warning'} sx={{ fontSize: 10 }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info" sx={{ fontSize: 12.5 }}>No evidence captured for this inspection yet.</Alert>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Append-Only Audit Trail
            </Typography>
            {auditRows.length ? (
              auditRows.slice(0, 8).map((r) => (
                <Box key={r.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6, borderBottom: '1px solid #f1f5f9' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{r.action}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.actor_name} · {fmt(r.created_at)}</Typography>
                  </Box>
                  <Chip
                    label={String(r.action).startsWith('geo_verification.suspicious') ? 'SUSPICIOUS' : String(r.action).startsWith('geo_verification') ? 'VERIFIED' : 'OK'}
                    size="small"
                    color={String(r.action).startsWith('geo_verification.suspicious') ? 'error' : String(r.action).startsWith('geo_verification') ? 'success' : 'default'}
                    sx={{ fontSize: 9.5, fontWeight: 800 }}
                  />
                </Box>
              ))
            ) : (
              <Alert severity="info" sx={{ fontSize: 12.5 }}>No audit events recorded for this inspection yet.</Alert>
            )}
          </Paper>
        </Grid>
      </Grid>

      {anomalies.length > 0 && (
        <Paper sx={{ p: 2, mt: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            AI-Flagged Indicators
          </Typography>
          {anomalies.map((a, idx) => (
            <Alert severity={String(a.severity || '').toLowerCase() === 'high' ? 'error' : 'warning'} key={idx} sx={{ mb: 1, fontSize: 12.5 }}>
              <strong>{a.title || a.name || `Anomaly ${idx + 1}`}:</strong> {a.detail || a.description || 'Refer to the AI Anomaly module for details.'}
            </Alert>
          ))}
        </Paper>
      )}

      <Divider sx={{ my: 2.5 }} />
      <Typography variant="caption" color="text.secondary">
        Dossier assembled live from the central inspection service · {fmt(new Date().toISOString())}
      </Typography>
    </Box>
  );
};

const Stack2 = ({ children }) => (
  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>{children}</Box>
);

export default InspectionDetail;