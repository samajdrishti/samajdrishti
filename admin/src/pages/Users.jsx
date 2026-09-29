import React from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Alert, Grid, Avatar, Divider,
} from '@mui/material';
import { VerifiedUser, AdminPanelSettings, SupervisorAccount, BadgeOutlined, GpsFixed, OfflineBolt, PhotoCamera } from '@mui/icons-material';

const ROLES = [
  {
    role: 'admin',
    label: 'DoSJE Admin / PMU',
    icon: <AdminPanelSettings />,
    tone: 'error',
    desc: 'Full command-desk access: dashboards, assignments, adjudication, users, audit trail.',
  },
  {
    role: 'supervisor',
    label: 'Zonal Supervisor',
    icon: <SupervisorAccount />,
    tone: 'warning',
    desc: 'Zone-level read + verify: monitors assigned officials, reviews evidence and ATR responses.',
  },
  {
    role: 'official',
    label: 'Field Inspection Officer',
    icon: <BadgeOutlined />,
    tone: 'info',
    desc: 'Mobile field app: accepts random allotments, runs the 7-step procedure, submits signed reports.',
  },
  {
    role: 'ngo',
    label: 'Grant-Aided NGO',
    icon: <PhotoCamera />,
    tone: 'secondary',
    desc: 'Views own facility dossier and submits ATR evidence for pending deficiencies.',
  },
];

const STAFF = [
  { name: 'Dr. Anjali Verma', email: 'admin@samajdrishti.gov.in', role: 'admin', dept: 'Central PMU, DoSJE', phone: '+91 98100 11223', division: 'National', lastActive: 'Now', feature: '✔' },
  { name: 'Vikram Singh', email: 'supervisor@samajdrishti.gov.in', role: 'supervisor', dept: 'Haryana Zonal Monitoring Cell', phone: '+91 98100 44556', division: 'Haryana', lastActive: '12 min ago', feature: '✔' },
  { name: 'Arun Kumar', email: 'official1@samajdrishti.gov.in', role: 'official', dept: 'PMU Field Inspection Wing', phone: '+91 98110 77881', division: 'Rohtak', lastActive: '8 min ago', feature: '✔' },
  { name: 'Priya Sharma', email: 'official2@samajdrishti.gov.in', role: 'official', dept: 'Social Welfare Audit Unit', phone: '+91 98110 77882', division: 'Jhajjar', lastActive: 'Yesterday', feature: '✔' },
  { name: 'Amit Patel', email: 'official3@samajdrishti.gov.in', role: 'official', dept: 'Rehab Monitoring Cell', phone: '+91 98110 77883', division: 'Gurugram', lastActive: '3 days ago', feature: '✔' },
  { name: 'Sunita Devi', email: 'official4@samajdrishti.gov.in', role: 'official', dept: 'PwD Empowerment Division', phone: '+91 98110 77884', division: 'Faridabad', lastActive: 'Online', feature: '✔' },
];

const roleColor = (role) =>
  role === 'admin' ? 'error' : role === 'supervisor' ? 'warning' : role === 'official' ? 'info' : 'default';

const Users = () => (
  <Box>
    <Box sx={{ mb: 2 }}>
      <Typography variant="h4">Users &amp; Roles</Typography>
      <Typography variant="body2" color="text.secondary">
        Personnel register and role-based access controls for the SmartInspect programme.
      </Typography>
    </Box>

    <Alert severity="success" sx={{ mb: 2, fontSize: 13 }}>
      All {STAFF.length} field personnel are authenticated with SAM-eGov credentials, two-factor login and
      role-restricted dashboards. Every account maps to the append-only audit trail.
    </Alert>

    <Grid container spacing={2} sx={{ mb: 3 }}>
      {ROLES.map((r) => (
        <Grid item xs={12} sm={6} md={3} key={r.role}>
          <Paper sx={{ p: 2, height: '100%', borderTop: `3px solid ${r.tone === 'error' ? '#dc2626' : r.tone === 'warning' ? '#d97706' : r.tone === 'info' ? '#2563eb' : '#64748b'}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: '#eef2ff', color: '#4338ca' }}>{r.icon}</Avatar>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{r.label}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" display="block">{r.desc}</Typography>
            <Chip label={r.role} size="small" color={r.tone || 'default'} sx={{ mt: 1, textTransform: 'capitalize' }} />
          </Paper>
        </Grid>
      ))}
    </Grid>

    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Officer</TableCell>
            <TableCell>Division</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Capabilities</TableCell>
            <TableCell>Last Active</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {STAFF.map((s) => (
            <TableRow key={s.email} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: '#e0e7ff', color: '#4338ca', fontSize: 13 }}>
                    {s.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{s.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.email} · {s.phone}</Typography>
                  </Box>
                </Box>
              </TableCell>
              <TableCell>{s.division}</TableCell>
              <TableCell>
                <Chip label={s.role} size="small" color={roleColor(s.role)} sx={{ textTransform: 'capitalize' }} />
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <Chip icon={<GpsFixed style={{ fontSize: 14 }} />} label="NavIC geofence" size="small" variant="outlined" sx={{ fontSize: 10.5 }} />
                  <Chip icon={<OfflineBolt style={{ fontSize: 14 }} />} label="Offline queue" size="small" variant="outlined" sx={{ fontSize: 10.5 }} />
                  <Chip icon={<PhotoCamera style={{ fontSize: 14 }} />} label="Evidence vault" size="small" variant="outlined" sx={{ fontSize: 10.5 }} />
                </Box>
              </TableCell>
              <TableCell>{s.lastActive}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>

    <Divider sx={{ my: 2.5 }} />

    <Paper sx={{ p: 2, bgcolor: '#f8fafc' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <VerifiedUser sx={{ fontSize: 18, color: '#059669' }} /> Access principles
      </Typography>
      {[
        'Field officials can only see their own allotments in the mobile app.',
        'A role change, password reset or new enrolment is itself an audit-log entry.',
        'No user (including the admin) can edit or delete an evidence hash or an audit event.',
      ].map((point) => (
        <Typography key={point} variant="body2" sx={{ color: '#334155', py: 0.5, display: 'flex', gap: 1 }}>
          <span style={{ color: '#059669', fontWeight: 800 }}>✓</span>{point}
        </Typography>
      ))}
    </Paper>
  </Box>
);

export default Users;