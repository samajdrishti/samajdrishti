import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Alert, Grid, Avatar, Divider, TextField, MenuItem, Tooltip,
  Card, CardContent, Stack, LinearProgress, Button,
} from '@mui/material';
import {
  VerifiedUser, AdminPanelSettings, SupervisorAccount, BadgeOutlined,
  GpsFixed, OfflineBolt, PhotoCamera, Search as SearchIcon, Shield as ShieldIcon,
  Check as CheckIcon, Close as CrossIcon, History as HistoryIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../services/api';

const ROLES = [
  {
    role: 'admin',
    label: 'DoSJE Admin / PMU',
    icon: <AdminPanelSettings />,
    tone: 'error',
    border: '#dc2626',
    desc: 'Full command-desk access: dashboards, assignments, adjudication, users, audit trail.',
  },
  {
    role: 'supervisor',
    label: 'Zonal Supervisor',
    icon: <SupervisorAccount />,
    tone: 'warning',
    border: '#d97706',
    desc: 'Zone-level read + verify: monitors assigned officials, reviews evidence and ATR responses.',
  },
  {
    role: 'official',
    label: 'Field Inspection Officer',
    icon: <BadgeOutlined />,
    tone: 'info',
    border: '#2563eb',
    desc: 'Mobile field app: accepts random allotments, runs the 7-step procedure, submits signed reports.',
  },
  {
    role: 'ngo',
    label: 'Grant-Aided NGO',
    icon: <PhotoCamera />,
    tone: 'secondary',
    border: '#64748b',
    desc: 'Views own facility dossier and submits ATR evidence for pending deficiencies.',
  },
];

const ROLE_CAPABILITIES = {
  admin: [
    { label: 'Command Center', icon: <AdminPanelSettings style={{ fontSize: 13 }} />, tip: 'Full command-desk access, GIS map, and live monitoring' },
    { label: 'AI Allotment Engine', icon: <ShieldIcon style={{ fontSize: 13 }} />, tip: 'Automated randomised, risk-weighted inspector allotment' },
    { label: 'ATR Adjudication', icon: <VerifiedUser style={{ fontSize: 13 }} />, tip: 'Review and final closure of Action Taken Reports' },
    { label: 'Audit Custodian', icon: <BadgeOutlined style={{ fontSize: 13 }} />, tip: 'Read and verify the append-only cryptographic audit trail' },
  ],
  supervisor: [
    { label: 'Zonal Oversight', icon: <SupervisorAccount style={{ fontSize: 13 }} />, tip: 'Monitors assigned officials and facility compliance across the zone' },
    { label: 'Evidence Sign-Off', icon: <VerifiedUser style={{ fontSize: 13 }} />, tip: 'Validates SHA-256 evidence integrity and seals approved photos' },
    { label: 'Video Call Hearing', icon: <PhotoCamera style={{ fontSize: 13 }} />, tip: 'Conducts tripartite review board video adjudication' },
    { label: 'ATR Review', icon: <BadgeOutlined style={{ fontSize: 13 }} />, tip: 'Inspects NGO remediation proofs against issued deficiencies' },
  ],
  official: [
    { label: '7-Step Procedure', icon: <BadgeOutlined style={{ fontSize: 13 }} />, tip: 'Conducts mandatory protocol: allotment, geofence, video check, checklist, AI analysis' },
    { label: 'NavIC Geofence Lock', icon: <GpsFixed style={{ fontSize: 13 }} />, tip: 'Inspection opens exclusively within 250m GPS/NavIC lock of facility' },
    { label: 'Offline Queue', icon: <OfflineBolt style={{ fontSize: 13 }} />, tip: 'Queues encrypted evidence on-device for sync upon network restoration' },
    { label: 'Tamper-Proof Camera', icon: <PhotoCamera style={{ fontSize: 13 }} />, tip: 'Captures watermarked, SHA-256 cryptographically chained site photos' },
  ],
  ngo: [
    { label: 'Facility Dossier', icon: <BadgeOutlined style={{ fontSize: 13 }} />, tip: 'Accesses own institution’s inspection findings and compliance score' },
    { label: 'ATR Evidence Upload', icon: <PhotoCamera style={{ fontSize: 13 }} />, tip: 'Submits corrective geotagged photos to rectify issued deficiencies' },
    { label: 'Deficiency Tracking', icon: <OfflineBolt style={{ fontSize: 13 }} />, tip: 'Monitors grace periods and rectification milestones' },
  ],
  beneficiary: [
    { label: 'Feedback Submission', icon: <BadgeOutlined style={{ fontSize: 13 }} />, tip: 'Submits direct social audit feedback on food, hygiene and care quality' },
    { label: 'Entitlement Tracker', icon: <VerifiedUser style={{ fontSize: 13 }} />, tip: 'Verifies personal scheme benefits and pension allotments' },
    { label: 'Grievance Redressal', icon: <ShieldIcon style={{ fontSize: 13 }} />, tip: 'Files grievance tickets for prompt PMU escalation' },
  ],
};

// Demonstration seed — aligned to Coimbatore, Tamil Nadu jurisdiction
const STAFF_SEED = [
  { name: 'Dr. S. Meenakshi', email: 'admin@samajdrishti.gov.in', role: 'admin', department: 'State PMU Cell, DoSJE - Coimbatore', phone: '+91 94422 11223', district: 'Coimbatore', state: 'Tamil Nadu', active: true, available: true, lastActive: 'Now (Active Session)' },
  { name: 'R. Karthikeyan', email: 'supervisor@samajdrishti.gov.in', role: 'supervisor', department: 'Coimbatore District Social Welfare Office', phone: '+91 94422 44556', district: 'Coimbatore', state: 'Tamil Nadu', active: true, available: true, lastActive: '6 min ago' },
  { name: 'M. Arun Kumar', email: 'official1@samajdrishti.gov.in', role: 'official', department: 'District PMU Field Inspection Wing, CBE', phone: '+91 94422 77881', district: 'Coimbatore', state: 'Tamil Nadu', active: true, available: true, lastActive: '42 min ago' },
  { name: 'B. Divya', email: 'official2@samajdrishti.gov.in', role: 'official', department: 'Social Welfare Audit Unit, Coimbatore', phone: '+91 94422 77882', district: 'Coimbatore', state: 'Tamil Nadu', active: true, available: true, lastActive: '1 hr ago' },
  { name: 'S. Karthik', email: 'official3@samajdrishti.gov.in', role: 'official', department: 'NAPDDR Rehab Monitoring Cell, CBE', phone: '+91 94422 77883', district: 'Coimbatore', state: 'Tamil Nadu', active: true, available: true, lastActive: 'Online (Field GPS Lock)' },
  { name: 'M. Sunitha', email: 'official4@samajdrishti.gov.in', role: 'official', department: 'SIPDA PwD Empowerment Division, CBE', phone: '+91 94422 77884', district: 'Coimbatore', state: 'Tamil Nadu', active: true, available: false, lastActive: '14 min ago' },
  { name: 'Anugraha Senior Home Admin', email: 'ngo@anugrahaseniors.org', role: 'ngo', department: 'Anugraha Senior Citizens Home, Kuniyamuthur', phone: '+91 94422 33445', district: 'Coimbatore', state: 'Tamil Nadu', active: true, available: true, lastActive: '2 hours ago' },
  { name: 'S. Ramasamy', email: 'beneficiary@samajdrishti.gov.in', role: 'beneficiary', department: 'Resident Beneficiary (Coimbatore)', phone: '+91 94422 99887', district: 'Coimbatore', state: 'Tamil Nadu', active: true, available: true, lastActive: 'Yesterday' },
];

// Capability matrix: which role can do what. Single source of truth for the table below.
const MATRIX = [
  { capability: 'Command dashboards & GIS map', admin: true, supervisor: true, official: false, ngo: false },
  { capability: 'Generate random assignments', admin: true, supervisor: false, official: false, ngo: false },
  { capability: 'Accept allotment & run 7-step procedure', admin: false, supervisor: false, official: true, ngo: false },
  { capability: 'Upload geo-tagged evidence (offline queue)', admin: false, supervisor: false, official: true, ngo: true },
  { capability: 'Verify evidence / adjudicate ATR', admin: true, supervisor: true, official: false, ngo: false },
  { capability: 'Submit ATR corrective evidence', admin: false, supervisor: false, official: false, ngo: true },
  { capability: 'Manage users & roles', admin: true, supervisor: false, official: false, ngo: false },
  { capability: 'Read append-only audit trail', admin: true, supervisor: true, official: false, ngo: false },
];

const roleColor = (role) =>
  role === 'admin' ? 'error' : role === 'supervisor' ? 'warning' : role === 'official' ? 'info' : 'default';

const initials = (name) =>
  String(name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

const divisionOf = (u) => u.district || u.division || u.state || '—';

const Users = () => {
  const [staff, setStaff] = useState(STAFF_SEED);
  const [source, setSource] = useState('seed');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    setLoading(true);
    userAPI.list()
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : res.data?.users || [];
        if (rows.length) {
          // Normalise backend shape onto the display shape; keep seed-only
          // niceties (lastActive) out — live rows show real active/available flags.
          setStaff(rows.map((u) => ({
            name: u.name || u.email,
            email: u.email,
            role: u.role,
            department: u.department || '—',
            phone: u.phone || '—',
            district: u.district,
            state: u.state,
            active: u.active !== false,
            available: u.available !== false,
            lastActive: u.lastActive || u.last_active || (u.active === false ? 'Deactivated' : (u.available === false ? 'On leave' : 'Active')),
          })));
          setSource('backend');
        }
      })
      .catch(() => { setStaff(STAFF_SEED); setSource('seed'); })
      .finally(() => setLoading(false));
  }, []);

  const navigate = useNavigate();

  const counts = useMemo(() => {
    const by = { admin: 0, supervisor: 0, official: 0, ngo: 0 };
    staff.forEach((s) => { if (by[s.role] !== undefined) by[s.role] += 1; });
    return by;
  }, [staff]);

  const activeCount = useMemo(() => staff.filter((s) => s.active !== false).length, [staff]);

  const visible = useMemo(() => staff.filter((s) => {
    if (roleFilter !== 'All' && s.role !== roleFilter) return false;
    if (statusFilter === 'Active' && s.active === false) return false;
    if (statusFilter === 'Deactivated' && s.active !== false) return false;
    if (statusFilter === 'Unavailable' && (s.active === false || s.available !== false)) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const hay = `${s.name} ${s.email} ${s.department} ${divisionOf(s)} ${s.phone}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [staff, roleFilter, statusFilter, query]);

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>Users &amp; Roles</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
            Personnel register and role-based access controls for the Samaj Drishti programme.
            Field officials see <strong>only their own allotments</strong> in the mobile app; every
            enrolment, role change and password reset is itself an audit-log entry.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small" color={source === 'backend' ? 'success' : 'warning'} variant="outlined"
            label={source === 'backend' ? 'Live personnel directory' : 'Demonstration seed'}
          />
          <Chip size="small" icon={<ShieldIcon />} label={`${activeCount}/${staff.length} active`} color="success" />
        </Stack>
      </Box>

      <Alert severity="success" sx={{ mb: 2, fontSize: 13 }}>
        All {staff.length} personnel sign in with SAM-eGov credentials, two-factor login and
        role-restricted dashboards. No user — including the admin — can edit or delete an
        evidence hash or an audit event.
      </Alert>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {ROLES.map((r) => (
          <Grid item xs={12} sm={6} md={3} key={r.role}>
            <Card sx={{ height: '100%', borderTop: `3px solid ${r.border}` }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: '#eef2ff', color: '#4338ca' }}>{r.icon}</Avatar>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{r.label}</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ minHeight: 32 }}>{r.desc}</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
                  <Chip label={r.role} size="small" color={r.tone || 'default'} sx={{ textTransform: 'capitalize' }} />
                  <Typography variant="caption" sx={{ fontWeight: 800 }}>
                    {counts[r.role] || 0} account{(counts[r.role] || 0) === 1 ? '' : 's'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small" label="Search name, email, department" value={query}
            onChange={(e) => setQuery(e.target.value)} sx={{ minWidth: 260, flexGrow: 1 }}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: '#64748b' }} /> }}
            placeholder="e.g. Arun, Rohtak, Rehab"
          />
          <TextField select size="small" label="Role" value={roleFilter} sx={{ minWidth: 150 }}
            onChange={(e) => setRoleFilter(e.target.value)}>
            {['All', 'admin', 'supervisor', 'official', 'ngo'].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Status" value={statusFilter} sx={{ minWidth: 150 }}
            onChange={(e) => setStatusFilter(e.target.value)}>
            {['All', 'Active', 'Unavailable', 'Deactivated'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        </Box>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Officer</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Division</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Role Capabilities</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((s) => (
              <TableRow key={s.email} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: s.active === false ? '#f1f5f9' : '#e0e7ff', color: s.active === false ? '#94a3b8' : '#4338ca', fontSize: 13 }}>
                      {initials(s.name)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{s.name}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">{s.department}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.email} · {s.phone}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{divisionOf(s)}</TableCell>
                <TableCell>
                  <Chip label={s.role} size="small" color={roleColor(s.role)} sx={{ textTransform: 'capitalize' }} />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box sx={{
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: s.active === false ? '#94a3b8' : s.available === false ? '#d97706' : '#059669',
                    }} />
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {s.active === false ? 'Deactivated' : s.available === false ? 'Unavailable' : 'Active'}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {s.lastActive || ''} · 2FA enforced
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 420 }}>
                    {(ROLE_CAPABILITIES[s.role] || []).map((cap) => (
                      <Tooltip key={cap.label} title={cap.tip}>
                        <Chip
                          icon={cap.icon}
                          label={cap.label}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: 10.5, fontWeight: 500 }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<HistoryIcon />}
                    onClick={() => navigate(`/audit?query=${encodeURIComponent(s.name)}`)}
                    sx={{ fontSize: 11, whiteSpace: 'nowrap' }}
                  >
                    Audit Trail
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!visible.length && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" sx={{ py: 2 }}>
                    No personnel match the current filters. Clear the search or widen the role band.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ my: 2.5 }} />

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
              Permission matrix — what each role can do
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Capability</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Admin</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Supervisor</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Official</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>NGO</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {MATRIX.map((row) => (
                    <TableRow key={row.capability} hover>
                      <TableCell sx={{ fontSize: 12.5 }}>{row.capability}</TableCell>
                      {['admin', 'supervisor', 'official', 'ngo'].map((r) => (
                        <TableCell key={r} align="center">
                          {row[r]
                            ? <CheckIcon fontSize="small" sx={{ color: '#059669' }} />
                            : <CrossIcon fontSize="small" sx={{ color: '#cbd5e1' }} />}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, bgcolor: '#f8fafc', height: '100%' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <VerifiedUser sx={{ fontSize: 18, color: '#059669' }} /> Access principles
            </Typography>
            {[
              'Field officials can only see their own allotments in the mobile app — never the full roster or other districts.',
              'A role change, password reset or new enrolment is itself an audit-log entry with actor, IP and timestamp.',
              'No user (including the admin) can edit or delete an evidence hash or an audit event. Corrections are new entries, never rewrites.',
              'Deactivated officers keep their history but are excluded from random assignment; unavailable officers are skipped until they return.',
            ].map((point) => (
              <Typography key={point} variant="body2" sx={{ color: '#334155', py: 0.5, display: 'flex', gap: 1, fontSize: 13 }}>
                <span style={{ color: '#059669', fontWeight: 800 }}>✓</span>{point}
              </Typography>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Users;
