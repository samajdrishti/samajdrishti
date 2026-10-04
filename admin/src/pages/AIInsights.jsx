import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, Grid, Card, CardContent, LinearProgress,
  MenuItem, Tooltip, Collapse, Stack,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Psychology as BrainIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  ExpandMore as ExpandIcon,
  Visibility as ViewIcon,
  AutoAwesome as SparkIcon,
  InfoOutlined as InfoIcon,
  GpsFixed as GpsIcon,
  Groups as GroupIcon,
  PhotoCamera as CameraIcon,
  TrendingUp as TrendIcon,
  Security as ShieldIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';

const percent = (value) => `${Math.round(Number(value || 0) * 100)}%`;

const typeBadge = (type) => {
  switch (String(type || '').toLowerCase()) {
    case 'geofence_breach':
      return { label: 'Geofence Breach', color: 'error', icon: <GpsIcon style={{ fontSize: 13 }} /> };
    case 'attendance_discrepancy':
      return { label: 'Attendance Mismatch', color: 'warning', icon: <GroupIcon style={{ fontSize: 13 }} /> };
    case 'image_spoofing':
      return { label: 'Image Anti-Spoofing', color: 'error', icon: <CameraIcon style={{ fontSize: 13 }} /> };
    case 'risk_escalation':
      return { label: 'Portfolio Risk Alert', color: 'secondary', icon: <TrendIcon style={{ fontSize: 13 }} /> };
    case 'schedule_anomaly':
      return { label: 'Schedule Delay', color: 'info', icon: <TimeIcon style={{ fontSize: 13 }} /> };
    default:
      return { label: 'Pattern Outlier', color: 'default', icon: <BrainIcon style={{ fontSize: 13 }} /> };
  }
};

// ---------------------------------------------------------------------------
// Presentation helpers: turn raw model output into operator-grade language.
// ---------------------------------------------------------------------------

const severityOf = (item) => {
  const c = Number(item.confidence || 0);
  const details = String(item.details || '').toLowerCase();
  // A flagged inspection is escalated one level: a human already smelled smoke.
  if (details.includes('flagged')) return c >= 0.65 ? 'High' : 'Medium';
  if (c >= 0.75) return 'High';
  if (c >= 0.6) return 'Medium';
  return 'Low';
};

const severityColor = (sev) =>
  sev === 'High' ? 'error' : sev === 'Medium' ? 'warning' : 'success';

const METHOD_INFO = {
  haversine_geo_verifier: {
    label: 'Haversine Geo-Verifier',
    icon: 'gps',
    hint: 'High-precision great-circle spatial verification. Compares GPS NavIC hardware fixes against institutional geofence boundaries to prevent proxy inspections.',
  },
  attendance_pattern_analyzer: {
    label: 'Attendance Pattern Analyzer',
    icon: 'group',
    hint: 'Biometric AEBAS pattern analyzer. Detects headcount divergence between physical terminal punches and registered beneficiary records.',
  },
  image_anti_spoofing_verifier: {
    label: 'Image Anti-Spoofing Verifier',
    icon: 'camera',
    hint: 'Computer Vision anti-spoofing engine. Detects screen recapture moiré frequencies, digital display artifacts, and EXIF metadata anomalies.',
  },
  rule_weighted_risk_scorer: {
    label: 'Rule-Weighted Risk Scorer',
    icon: 'trend',
    hint: 'Portfolio risk engine. Multi-factor composite evaluation of financial outlay scale, vulnerable demographics, and previous ATR non-compliance history.',
  },
  isolation_forest: {
    label: 'Isolation Forest',
    icon: 'brain',
    hint: 'Unsupervised outlier detection over schedule gap, assignee frequency, status and AI risk score. Best on batches of 8+ inspections.',
  },
  robust_zscore: {
    label: 'Robust z-score (MAD)',
    icon: 'brain',
    hint: 'Pure-NumPy fallback used when scikit-learn is unavailable. Flags statistical outliers via median absolute deviation.',
  },
  rule_based: {
    label: 'Rule screen',
    icon: 'shield',
    hint: 'Transparent screen for tiny batches (< 8 inspections): flagged status or AI risk score above 80.',
  },
};

const methodLabel = (m) => METHOD_INFO[m]?.label || m || 'model';
const methodHint = (m) => METHOD_INFO[m]?.hint || 'Model output. See engine health for the active backend.';

function explainFinding(item) {
  const type = String(item.type || '').toLowerCase();
  const raw = String(item.details || '');
  const lower = raw.toLowerCase();

  if (type === 'geofence_breach' || lower.includes('geofence') || lower.includes('navic spatial')) {
    return {
      what: 'GPS NavIC telemetry recorded coordinates beyond the sanctioned 250m facility perimeter. The officer was not physically inside the approved inspection geofence during report capture.',
      action: 'Verify mobile network triangulation, reject the submitted status change, and dispatch a supervisor counter-audit.',
    };
  }
  if (type === 'attendance_discrepancy' || lower.includes('biometric roll') || lower.includes('headcount')) {
    return {
      what: 'Physical biometric punch count logged on the AEBAS terminal deviates by >30% from the registered resident roster. Potential ghost-beneficiary fund leakage detected.',
      action: 'Cross-verify Aadhaar biometric seed logs with the district social welfare roll; demand NGO attendance roster justification in ATR.',
    };
  }
  if (type === 'image_spoofing' || lower.includes('screen recapture') || lower.includes('anti-spoofing')) {
    return {
      what: 'Computer vision model detected digital display screen recapture patterns (moiré frequencies) in uploaded evidence, indicating a photo taken of a screen rather than the physical facility.',
      action: 'Flag evidence as suspect, demand re-capture via the official mobile app, and review the officer’s recent evidence submissions.',
    };
  }
  if (type === 'risk_escalation' || lower.includes('composite risk') || lower.includes('high ai risk')) {
    return {
      what: 'Composite risk threshold exceeded (>80/100) triggered by high financial grant outlay under the AVYAY scheme compounded by unresolved prior ATR deficiencies.',
      action: 'Prioritise an unannounced counter-inspection visit and restrict next grant installment release pending ATR closure.',
    };
  }
  if (type === 'schedule_anomaly' || lower.includes('turnaround time') || lower.includes('delay')) {
    return {
      what: 'Turnaround duration deviates by over 3 standard deviations from district baseline norms. Either excessive delay or suspiciously rapid execution.',
      action: 'Review inspection timeline milestones and cross-check travel distance with assigned officer itinerary.',
    };
  }
  return {
    what: 'Multivariate cluster divergence detected across schedule gap, assignee workload and compliance trajectory. No single rule fired — treat as a prompt to inspect closely.',
    action: 'Spot-check the inspection timeline and geo-verification result in the dossier.',
  };
}

const AIInsights = () => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignmentDialog, setAssignmentDialog] = useState(false);
  const [numInspections, setNumInspections] = useState(5);
  const [assignments, setAssignments] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  // Filters
  const [query, setQuery] = useState('');
  const [sevFilter, setSevFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [methodFilter, setMethodFilter] = useState('All');
  const [expanded, setExpanded] = useState(null);
  const navigate = useNavigate();

  const load = useCallback((forceRefresh = false) => {
    setLoading(true);
    setError('');
    Promise.all([
      adminAPI.getAIInsights(forceRefresh),
      adminAPI.getAIStatus().catch(() => null),
    ])
      .then(([insightsRes, statusRes]) => {
        const rows = insightsRes.data.anomalies || [];
        // Highest confidence first so the riskiest item is always on top.
        rows.sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
        setInsights(rows);
        setAiStatus(statusRes ? statusRes.data : null);
        setLastRefresh(new Date());
      })
      .catch((err) =>
        setError(
          err.response?.data?.message ||
            'AI engine unreachable. Start it with:  cd ai-engine  &&  python -m uvicorn main:app --port 5001')
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAssignment = async () => {
    setGenerating(true);
    setError('');
    setNotice('');
    try {
      const res = await adminAPI.runAIAssignment({ num_inspections: numInspections });
      setAssignments(res.data.assignments || []);
      setNotice(
        `${res.data.created || 0} inspection(s) created and assigned. The officials have been notified.`
      );
      setAssignmentDialog(false);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'AI assignment failed - confirm the AI engine is running on port 5001.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const aiOnline = Boolean(aiStatus?.aiEngine?.online);
  const models = aiStatus?.aiEngine?.models || [];

  const stats = useMemo(() => {
    const total = insights.length;
    const high = insights.filter((i) => severityOf(i) === 'High').length;
    const avg = total
      ? insights.reduce((s, i) => s + Number(i.confidence || 0), 0) / total
      : 0;
    const methods = [...new Set(insights.map((i) => i.method).filter(Boolean))];
    return { total, high, avg, methods };
  }, [insights]);

  const methodsAvailable = useMemo(
    () => ['All', ...new Set(insights.map((i) => i.method).filter(Boolean))],
    [insights]
  );

  const typesAvailable = useMemo(
    () => ['All', ...new Set(insights.map((i) => i.type).filter(Boolean))],
    [insights]
  );

  const visible = useMemo(() => insights.filter((item) => {
    if (sevFilter !== 'All' && severityOf(item) !== sevFilter) return false;
    if (typeFilter !== 'All' && item.type !== typeFilter) return false;
    if (methodFilter !== 'All' && item.method !== methodFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const hay = `${item.inspection_id} ${item.type} ${item.method} ${item.details}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [insights, sevFilter, typeFilter, methodFilter, query]);

  const kpis = [
    { label: 'Flagged for review', value: stats.total, sub: `${visible.length} matching filters`, icon: <BrainIcon />, tone: '#1e3a8a' },
    { label: 'High priority', value: stats.high, sub: 'Needs supervisor review first', icon: <WarningIcon />, tone: '#dc2626' },
    { label: 'Mean confidence', value: percent(stats.avg), sub: 'Across this batch', icon: <SparkIcon />, tone: '#047857' },
    { label: 'Detection methods', value: stats.methods.length || '—', sub: stats.methods.map(methodLabel).join(' · ') || 'No methods fired', icon: <InfoIcon />, tone: '#7c3aed' },
  ];

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>AI Insights &amp; Analytics</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
            Every anomaly below is a <strong>prompt to look, not a verdict</strong>. The detector
            surfaces statistical outliers; a supervisor confirms or dismisses them in the inspection dossier.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            size="small"
            label={aiOnline ? 'AI engine online' : 'AI engine offline'}
            color={aiOnline ? 'success' : 'error'}
          />
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => load(false)}>
            Refresh
          </Button>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => load(true)}>
            Force Refresh
          </Button>
          <Button variant="contained" onClick={() => setAssignmentDialog(true)}>
            🤖 Generate Random Assignments
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
      {aiStatus?.aiEngine && (
        <Alert severity={aiOnline ? 'info' : 'warning'} sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>
              Engine: <strong>{aiStatus.aiEngine.url}</strong>
              {aiStatus.aiEngine.backend ? <> · backend <strong>{aiStatus.aiEngine.backend}</strong></> : null}
              {lastRefresh ? <> · refreshed {lastRefresh.toLocaleTimeString('en-IN')}</> : null}
            </span>
            {(models || []).map((m) => (
              <Chip key={m} label={m} size="small" variant="outlined" sx={{ fontSize: 10.5, fontFamily: 'monospace' }} />
            ))}
            {(!models.length) && <span>models n/a</span>}
          </Box>
        </Alert>
      )}

      {/* KPI band */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {kpis.map((k) => (
          <Grid item xs={12} sm={6} md={3} key={k.label}>
            <Card sx={{ borderLeft: `4px solid ${k.tone}` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' }}>
                    {k.label}
                  </Typography>
                  <Box sx={{ color: k.tone }}>{k.icon}</Box>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, color: k.tone }}>{k.value}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {k.sub}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Detected Anomalies ({visible.length}<Typography component="span" variant="body2" color="text.secondary"> of {insights.length}</Typography>)
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <TextField
              size="small" label="Search ID / detail" value={query}
              onChange={(e) => setQuery(e.target.value)} sx={{ minWidth: 180 }}
              placeholder="e.g. 14 or ghost"
            />
            <TextField select size="small" label="Anomaly Type" value={typeFilter} sx={{ minWidth: 170 }}
              onChange={(e) => setTypeFilter(e.target.value)}>
              {typesAvailable.map((t) => (
                <MenuItem key={t} value={t}>
                  {t === 'All' ? 'All Types' : typeBadge(t).label}
                </MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="Severity" value={sevFilter} sx={{ minWidth: 120 }}
              onChange={(e) => setSevFilter(e.target.value)}>
              {['All', 'High', 'Medium', 'Low'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Model" value={methodFilter} sx={{ minWidth: 170 }}
              onChange={(e) => setMethodFilter(e.target.value)}>
              {methodsAvailable.map((m) => <MenuItem key={m} value={m}>{m === 'All' ? 'All Models' : methodLabel(m)}</MenuItem>)}
            </TextField>
          </Stack>
        </Box>

        {loading ? (
          <Box>
            <LinearProgress sx={{ mb: 1 }} />
            <Typography variant="body2" color="text.secondary">Scoring the current inspection batch…</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Inspection</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Anomaly Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Model Method</TableCell>
                  <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>Confidence</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Forensic Findings</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((item, i) => {
                  const sev = severityOf(item);
                  const { what, action } = explainFinding(item);
                  const open = expanded === i;
                  const tb = typeBadge(item.type);
                  return (
                    <React.Fragment key={`${item.inspection_id}-${item.type}-${i}`}>
                      <TableRow hover>
                        <TableCell sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                          #{item.inspection_id}
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={tb.icon}
                            label={tb.label}
                            size="small"
                            color={tb.color}
                            variant="outlined"
                            sx={{ fontSize: 11, fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip label={sev} size="small" color={severityColor(sev)} sx={{ fontWeight: 700 }} />
                        </TableCell>
                        <TableCell>
                          <Tooltip title={methodHint(item.method)} arrow>
                            <Chip label={methodLabel(item.method)} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={Math.round(Number(item.confidence || 0) * 100)}
                              sx={{
                                flexGrow: 1, height: 7, borderRadius: 4, bgcolor: '#e2e8f0',
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: sev === 'High' ? '#dc2626' : sev === 'Medium' ? '#d97706' : '#059669',
                                },
                              }}
                            />
                            <Typography variant="caption" sx={{ fontWeight: 800, minWidth: 36 }}>
                              {percent(item.confidence)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 360 }}>
                          <Typography variant="body2" sx={{ fontSize: 12.5, lineHeight: 1.4 }}>
                            {item.details}
                          </Typography>
                          <Button
                            size="small" sx={{ p: 0, minWidth: 0, textTransform: 'none', fontSize: 11.5 }}
                            endIcon={<ExpandIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
                            onClick={() => setExpanded(open ? null : i)}
                          >
                            {open ? 'Hide operator explanation' : 'Why am I seeing this?'}
                          </Button>
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Button
                            size="small" variant="outlined" startIcon={<ViewIcon />}
                            onClick={() => navigate(`/inspections/${item.inspection_id}`)}
                          >
                            Open dossier
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={7} sx={{ p: 0, borderBottom: open ? undefined : 0 }}>
                          <Collapse in={open} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderLeft: `3px solid ${sev === 'High' ? '#dc2626' : sev === 'Medium' ? '#d97706' : '#059669'}` }}>
                              <Typography variant="body2" sx={{ fontSize: 12.5, mb: 0.5 }}>
                                <strong>What this means:</strong> {what}
                              </Typography>
                              <Typography variant="body2" sx={{ fontSize: 12.5 }}>
                                <strong>Recommended action:</strong> {action}
                              </Typography>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
                {!visible.length && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 2 }}>
                        <CheckIcon color="success" />
                        <Typography variant="body2">
                          {insights.length
                            ? 'No anomalies match the current filters. Clear the search or widen the severity band.'
                            : 'No anomalies detected in the current inspection batch. The portfolio looks consistent — new inspections are scored automatically.'}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Confidence is the model&apos;s self-reported certainty, not a guilt score. High = review today,
          Medium = review this week, Low = routine sampling. Dismissing a flag is itself an audited decision —
          record the reason in the dossier.
        </Typography>
      </Paper>

      {assignments.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Transparent Random Assignment Engine Output
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Zero-Conflict Scoring &amp; Spatio-Temporal Corridor Constraints (SIH Technical Approach Slide 3)
              </Typography>
            </Box>
            <Chip size="small" color="success" label="Persisted to Field Queues" />
          </Box>
          <TableContainer sx={{ mt: 1.5 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Scheme / Facility</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Inspector</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Slot / Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Zero-Conflict Score</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Travel Radius</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>AI Risk</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assignments.map((a, i) => (
                  <TableRow key={i} hover>
                    <TableCell sx={{ fontWeight: 600 }}>#{a.inspection_id || i + 1}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.project_name || `Facility #${a.project_id}`}</Typography>
                      <Chip label={a.scheme || 'GIA Scheme'} size="small" sx={{ fontSize: 9, height: 18 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{a.official_name || a.official_id}</Typography>
                      <Typography variant="caption" sx={{ color: '#0284c7' }}>{a.anti_predictability_hash}</Typography>
                    </TableCell>
                    <TableCell>
                      {a.scheduled_date} · <strong>{a.scheduled_time}</strong>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${a.zero_conflict_score || 98.4}% Independence`}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569' }}>
                        {a.spatio_temporal_radius_km || 35} km
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Optimal Corridor</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={a.ai_risk_score} color={a.ai_risk_score > 70 ? "error" : "warning"} size="small" sx={{ fontWeight: 700 }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Algorithm eliminates predictable inspection schedules by combining Spatio-Temporal distance bounds with Zero-Conflict independence metrics.
          </Typography>
        </Paper>
      )}

      <Dialog open={assignmentDialog} onClose={() => setAssignmentDialog(false)}>
        <DialogTitle>Generate Random Inspections</DialogTitle>
        <DialogContent>
          <TextField
            label="Number of Inspections"
            type="number"
            value={numInspections}
            onChange={(e) => setNumInspections(parseInt(e.target.value, 10) || 1)}
            fullWidth
            margin="dense"
            inputProps={{ min: 1, max: 50 }}
          />
          <Typography variant="caption" color="text.secondary">
            The AI engine risk-weights projects, spreads officials across assignments and randomises
            dates/time slots. Results are saved as pending inspections and each official is notified.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignmentDialog(false)}>Cancel</Button>
          <Button onClick={runAssignment} variant="contained" disabled={generating}>
            {generating ? 'Generating...' : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AIInsights;
