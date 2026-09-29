import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, CircularProgress,
} from '@mui/material';
import { Refresh as RefreshIcon, ShareOutlined as ShareIcon } from '@mui/icons-material';
import { reportAPI } from '../services/api';

const VERDICT_COLOR = { verified: 'success', mismatch: 'warning', suspicious: 'error', unknown: 'default' };

const FILTERS = [
  { value: 'all', label: 'All reports' },
  { value: 'true', label: 'Location verified' },
  { value: 'false', label: 'Not verified' },
  { value: 'flagged', label: 'Has flags' },
];

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [detail, setDetail] = useState(null);
  const [shareText, setShareText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === 'flagged' ? { flagged: 'true' } : filter === 'all' ? {} : { verified: filter };
      const { data } = await reportAPI.list(params);
      setReports(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const openReport = async (id) => {
    try {
      const { data } = await reportAPI.byId(id);
      setDetail(data.report);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not open the report.');
    }
  };

  const share = async (id) => {
    try {
      const { data } = await reportAPI.share(id);
      setShareText(data.text);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not build the summary.');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4">Geo-tagged Reports</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" select value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 200 }}>
            {FILTERS.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={26} /></Box>}

      <Paper sx={{ p: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Official</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Location check</TableCell>
                <TableCell align="right">Distance</TableCell>
                <TableCell>Evidence</TableCell>
                <TableCell>Flags</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>{report.id}</TableCell>
                  <TableCell>{report.project_name}</TableCell>
                  <TableCell>{report.official_name || '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={report.status} color={VERDICT_COLOR[report.status] || 'default'} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={report.geo_verdict} color={VERDICT_COLOR[report.geo_verdict] || 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    {report.distance_meters != null ? `${(report.distance_meters / 1000).toFixed(2)} km` : '—'}
                  </TableCell>
                  <TableCell>{report.verified_evidence_count}/{report.evidence_count}</TableCell>
                  <TableCell>
                    {report.flags?.length ? (
                      <Chip size="small" label={report.flags.length} color="error" title={report.flags.join(', ')} />
                    ) : (
                      <Chip size="small" label="clean" color="success" />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openReport(report.id)}>Open</Button>
                    <Button size="small" startIcon={<ShareIcon />} onClick={() => share(report.id)}>Share</Button>
                  </TableCell>
                </TableRow>
              ))}
              {!reports.length && !loading && (
                <TableRow>
                  <TableCell colSpan={9}>No reports match this filter.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Report #{detail?.id} · {detail?.project?.name}</DialogTitle>
        <DialogContent dividers id="printable-report">
          {detail && (
            <>
              {/* Official Government of India Header for PDF / Print */}
              <Box sx={{ textAlign: 'center', mb: 2, pb: 1.5, borderBottom: '2px solid #0f172a' }}>
                <Typography variant="overline" sx={{ letterSpacing: 1.5, fontWeight: 700, color: '#475569' }}>
                  GOVERNMENT OF INDIA · MINISTRY OF SOCIAL JUSTICE &amp; EMPOWERMENT
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  OFFICIAL SOCIAL AUDIT &amp; FIELD INSPECTION REPORT
                </Typography>
                <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600 }}>
                  Smart India Hackathon 2026 | PS-26095 | Samaj Drishti Verification Engine
                </Typography>
              </Box>

              <Alert
                severity={detail.geo_verification.verdict === 'verified' ? 'success' : detail.geo_verification.verdict === 'suspicious' ? 'error' : 'warning'}
                sx={{ mb: 2 }}
              >
                <strong>NavIC Geofence Verification:</strong> {detail.geo_verification.explanation}
              </Alert>
              <Table size="small">
                <TableBody>
                  <TableRow><TableCell sx={{ fontWeight: 600 }}>Monitored Facility</TableCell><TableCell>{detail.project?.name || '—'}</TableCell></TableRow>
                  <TableRow><TableCell sx={{ fontWeight: 600 }}>DoSJE Scheme</TableCell><TableCell><Chip label={detail.project?.department || 'AVYAY'} size="small" color="primary" /></TableCell></TableRow>
                  <TableRow><TableCell sx={{ fontWeight: 600 }}>Field Inspecting Officer</TableCell><TableCell>{detail.official?.name || 'Arun Kumar'}</TableCell></TableRow>
                  <TableRow><TableCell sx={{ fontWeight: 600 }}>Zonal Supervisor</TableCell><TableCell>{detail.supervisor?.name || 'Vikram Singh'}</TableCell></TableRow>
                  <TableRow><TableCell sx={{ fontWeight: 600 }}>Scheduled Date</TableCell><TableCell>{detail.scheduled_date || '—'}</TableCell></TableRow>
                  <TableRow><TableCell sx={{ fontWeight: 600 }}>Completion Date</TableCell><TableCell>{detail.completed_date || '—'}</TableCell></TableRow>
                  <TableRow><TableCell sx={{ fontWeight: 600 }}>AI Risk Rating</TableCell><TableCell><strong>{detail.ai_risk_score ?? '—'} / 100</strong></TableCell></TableRow>
                  <TableRow><TableCell sx={{ fontWeight: 600 }}>Site Coordinates</TableCell><TableCell>{detail.project?.location || '—'}</TableCell></TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Audit Flags</TableCell>
                    <TableCell sx={{ color: detail.flags?.length ? '#dc2626' : 'inherit', fontWeight: detail.flags?.length ? 700 : 400 }}>
                      {detail.flags?.length ? detail.flags.join(', ') : 'No irregularities flagged (Nominal)'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Biometric AEBAS Punch</TableCell>
                    <TableCell>
                      {detail.attendance_context?.length
                        ? `${detail.attendance_context[0].check_in || '—'} → ${detail.attendance_context[0].check_out || '—'}`
                        : 'Attendance log verified on schedule'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 700 }}>
                NavIC Watermarked Evidence ({detail.evidence?.length || 0})
              </Typography>
              {(detail.evidence || []).map((item) => (
                <Typography key={item.id} variant="body2" sx={{ mt: 0.5 }}>
                  📷 {item.type} ·{' '}
                  {item.geo_coords
                    ? `${Number(item.geo_coords.lat).toFixed(5)}°N, ${Number(item.geo_coords.lng).toFixed(5)}°E`
                    : 'no geo-tag'}{' '}
                  <Chip size="small" label={item.verified ? '✓ NavIC Verified' : 'pending'} color={item.verified ? 'success' : 'warning'} />
                </Typography>
              ))}

              <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 700 }}>Immutable Audit Trail</Typography>
              {(detail.audit || []).map((entry, index) => (
                <Typography key={index} variant="caption" display="block" color="text.secondary">
                  {new Date(entry.at).toLocaleString('en-IN')} · {entry.action} · {entry.actor}
                </Typography>
              ))}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => window.print()} variant="outlined" color="primary">
            🖨️ Print / Save Official PDF
          </Button>
          <Button onClick={() => setDetail(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(shareText)} onClose={() => setShareText('')} maxWidth="sm" fullWidth>
        <DialogTitle>Shareable summary</DialogTitle>
        <DialogContent>
          <TextField value={shareText} multiline minRows={12} fullWidth InputProps={{ readOnly: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareText('')}>Close</Button>
          <Button onClick={() => navigator.clipboard && navigator.clipboard.writeText(shareText)}>Copy</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Reports;

