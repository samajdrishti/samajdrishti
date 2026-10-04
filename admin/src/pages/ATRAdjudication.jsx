import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, Alert, Card, CardContent,
  Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Stack, Divider, MenuItem,
} from '@mui/material';
import {
  Gavel as GavelIcon,
  CheckCircleOutline,
  HighlightOff,
  PriorityHigh,
  OpenInNew as OpenIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { atrAPI, userAPI } from '../services/api';

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

  // Raise-a-new-ATR dialog.
  const [createOpen, setCreateOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    projectId: '',
    inspectionId: '',
    assignedTo: '',
    actionDescription: '',
    deficiencyTitle: '',
    deadline: '',
    priority: 'normal',
  });

  const openCreate = async () => {
    setForm((f) => ({ ...f, projectId: '', inspectionId: '', assignedTo: '', actionDescription: '', deficiencyTitle: '', deadline: '', priority: 'normal' }));
    setCreateOpen(true);
    try {
      const res = await userAPI.list({ active: true });
      setUsers(Array.isArray(res.data) ? res.data.filter((u) => u.role === 'official' || u.role === 'ngo') : []);
    } catch (err) {
      setUsers([]);
    }
  };

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleCreate = async () => {
    if (!form.actionDescription.trim()) {
      setMessage('An action description is required to raise an ATR.');
      return;
    }
    setCreating(true);
    try {
      await atrAPI.create({
        project_id: form.projectId ? Number(form.projectId) : null,
        inspection_id: form.inspectionId ? Number(form.inspectionId) : null,
        assigned_to: form.assignedTo ? Number(form.assignedTo) : null,
        action_description: form.actionDescription,
        deficiency_title: form.deficiencyTitle || null,
        deadline: form.deadline || null,
        priority: form.priority || null,
      });
      setMessage('ATR raised — the assignee has been notified and the mobile app will show a new action.');
      setCreateOpen(false);
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not raise the ATR.');
    } finally {
      setCreating(false);
    }
  };

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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" size="small" color="success" startIcon={<GavelIcon />} onClick={openCreate}>
            Raise New ATR
          </Button>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={load}>
            Refresh
          </Button>
        </Box>
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

      {/* Raise a new ATR dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>⚖️ Raise New Action Taken Report</DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            An ATR must reference an inspection, anomaly or project so it can be traced. The assignee
            is notified immediately and sees the new action on their mobile app.
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select fullWidth size="small" label="Assign to (official / NGO)" value={form.assignedTo}
              onChange={setField('assignedTo')}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>{u.name} ({u.role})</MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                size="small" label="Project ID (optional)" value={form.projectId}
                onChange={setField('projectId')} sx={{ flexGrow: 1 }}
              />
              <TextField
                size="small" label="Inspection ID (optional)" value={form.inspectionId}
                onChange={setField('inspectionId')} sx={{ flexGrow: 1 }}
              />
            </Stack>
            <TextField
              size="small" label="Deficiency / action title" value={form.deficiencyTitle}
              onChange={setField('deficiencyTitle')} fullWidth
            />
            <TextField
              size="small" multiline rows={3} label="Action description (required)"
              value={form.actionDescription} onChange={setField('actionDescription')} fullWidth
            />
            <Stack direction="row" spacing={2}>
              <TextField
                size="small" type="date" label="Deadline (optional)" value={form.deadline}
                onChange={setField('deadline')} sx={{ flexGrow: 1 }} InputLabelProps={{ shrink: true }}
              />
              <TextField
                select size="small" label="Priority" value={form.priority} onChange={setField('priority')}
                sx={{ width: 130 }}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </TextField>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" color="success" disabled={creating} onClick={handleCreate}>
            {creating ? 'Raising…' : 'Raise ATR'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ATRAdjudication;
