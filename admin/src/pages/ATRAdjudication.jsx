import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, Alert, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Stack, Divider,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  CheckCircleOutline,
  HighlightOff,
  PriorityHigh,
  OpenInNew as OpenIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { atrAPI } from '../services/api';

const statusColors = {
  escalated: 'error',
  under_review: 'warning',
  approved_closed: 'success',
  rejected_reinspection: 'error',
};

const ATRAdjudication = () => {
  const [atrs, setAtrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedATR, setSelectedATR] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjudicationVerdict, setAdjudicationVerdict] = useState('');
  const [actionType, setActionType] = useState('approve'); // 'approve' | 'escalate' | 'reject'
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await atrAPI.list();
      setAtrs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load ATRs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpenAdjudicate = (atr, action) => {
    setSelectedATR(atr);
    setActionType(action);
    setAdjudicationVerdict(
      action === 'approve'
        ? 'APPROVED_AND_CLOSED - Rectification evidence verified compliant with DoSJE guidelines.'
        : action === 'escalate'
        ? 'ESCALATED - Deficiency persists; issue Formal Show Cause Notice & recommend Blacklist.'
        : 'RE-INSPECTION REQUIRED - Physical on-site verification required by PMU officer.'
    );
    setDialogOpen(true);
  };

  const handleConfirmAdjudication = async () => {
    if (!selectedATR) return;
    try {
      await atrAPI.adjudicate(selectedATR.id, {
        action: actionType,
        pmu_adjudication: adjudicationVerdict,
      });
      setMessage(`ATR #${selectedATR.id} adjudicated successfully as ${actionType.toUpperCase()}`);
      setDialogOpen(false);
      load();
    } catch (err) {
      console.error('Adjudicate error:', err);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            ⚖️ Digital Action Taken Report (ATR) Adjudication
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Central PMU & Zonal Monitoring Cell · Institutional Deficiency Adjudication & Enforcement
          </Typography>
        </Box>
        <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={load}>
          Refresh
        </Button>
      </Box>

      {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}

      {/* Overview Stat Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { label: 'Total ATR Records', val: atrs.length, color: '#3b82f6' },
          { label: 'Under Review', val: atrs.filter((a) => a.status === 'under_review').length, color: '#f59e0b' },
          { label: 'Escalated / Blacklisted', val: atrs.filter((a) => a.status === 'escalated').length, color: '#ef4444' },
          { label: 'Resolved & Closed', val: atrs.filter((a) => a.status === 'approved_closed').length, color: '#10b981' },
        ].map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: s.color, fontWeight: 700 }}>{s.val}</Typography>
              <Typography variant="body2" color="text.secondary">{s.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Case Study Callout Banner */}
      <Paper sx={{ p: 2.5, mb: 3, bgcolor: '#fef2f2', border: '1px solid #fecaca' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <PriorityHigh sx={{ color: '#dc2626', mt: 0.5 }} />
          <Box>
            <Typography variant="subtitle1" sx={{ color: '#991b1b', fontWeight: 700 }}>
              District Case Study Spotlight: Anugraha Senior Citizens Home, Coimbatore (AVYAY)
            </Typography>
            <Typography variant="body2" sx={{ color: '#7f1d1d', mt: 0.5 }}>
              Deficiencies flagged 13 Aug 2020 → GIA Grant cancelled Oct 2020 → Revived Dec 2022 → Fraudulent surprise inspection detected 17 Nov 2023 → <strong>Permanently Blacklisted by DoSJE Order 18 Jul 2024</strong> following automated biometric discrepancy forensic audit.
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* ATR Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>ID / Scheme</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Institution / Project</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Deficiency Title & Findings</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Deadline</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Adjudication Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {atrs.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Typography variant="subtitle2">#{row.id}</Typography>
                  <Chip label={row.scheme} size="small" sx={{ fontSize: 10, fontWeight: 700, mt: 0.5 }} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.project_name}</Typography>
                  <Typography variant="caption" color="text.secondary">Adjudicator: {row.official_name || 'Dr. Anjali Verma'}</Typography>
                </TableCell>
                <TableCell sx={{ maxWidth: 320 }}>
                  <Typography variant="body2" sx={{ color: '#b91c1c', fontWeight: 600 }}>
                    {row.deficiency_title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                    {row.deficiency_details}
                  </Typography>
                  {row.ngo_reply && (
                    <Box sx={{ mt: 1, p: 1, bgcolor: '#f1f5f9', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>NGO Reply:</Typography>
                      <Typography variant="caption">{row.ngo_reply}</Typography>
                    </Box>
                  )}
                  {row.pmu_adjudication && (
                    <Box sx={{ mt: 0.5, p: 0.8, bgcolor: '#e0f2fe', borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#0369a1', display: 'block' }}>PMU Order:</Typography>
                      <Typography variant="caption" sx={{ color: '#0369a1' }}>{row.pmu_adjudication}</Typography>
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{row.deadline}</Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.status.replace('_', ' ')}
                    color={statusColors[row.status] || 'default'}
                    size="small"
                    sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      onClick={() => handleOpenAdjudicate(row, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      onClick={() => handleOpenAdjudicate(row, 'escalate')}
                    >
                      Escalate
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Adjudication Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {actionType === 'approve' ? '✅ Approve & Close Finding' : '🚨 Escalate to DoSJE Blacklist'}
        </DialogTitle>
        <DialogContent dividers>
          {selectedATR && (
            <>
              <Typography variant="subtitle2">{selectedATR.project_name}</Typography>
              <Typography variant="body2" sx={{ color: '#b91c1c', mb: 2 }}>{selectedATR.deficiency_title}</Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="PMU Official Adjudication Order"
                value={adjudicationVerdict}
                onChange={(e) => setAdjudicationVerdict(e.target.value)}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={actionType === 'approve' ? 'success' : 'error'}
            onClick={handleConfirmAdjudication}
          >
            Confirm & Issue Order
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ATRAdjudication;
