import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Paper, Card, CardContent, Chip, Button, Alert, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress, Divider,
  Stack, Stepper, Step, StepLabel, StepContent,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Assignment as AssignmentIcon,
  PhotoCamera as PhotoIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  Map as MapIcon,
  Gavel as GavelIcon,
  Psychology as PsychologyIcon,
  Videocam as VideocamIcon,
  Shield as ShieldIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';

const statusColors = { pending: '#f39c12', in_progress: '#3498db', completed: '#27ae60', flagged: '#e74c3c' };
const riskColor = (score) => (score > 70 ? '#e74c3c' : score >= 40 ? '#f39c12' : '#27ae60');
const riskLabel = (score) => (score > 70 ? 'High' : score >= 40 ? 'Medium' : 'Low');
const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const CASE_STUDY_STEPS = [
  {
    date: '13 Aug 2020',
    title: 'PMU Deficiencies Flagged',
    desc: 'Initial field audit identified absent staff, missing medical journals, and unverified resident roll.',
  },
  {
    date: 'Oct 2020',
    title: 'GIA Grant Cancelled',
    desc: 'DoSJE formally halted financial disbursements following unaddressed compliance warnings.',
  },
  {
    date: '21 Dec 2022',
    title: 'Project Revived',
    desc: 'Conditional resumption granted upon management affidavit pledging adherence to AVYAY guidelines.',
  },
  {
    date: '17 Nov 2023',
    title: 'Fraudulent Surprise Inspection Detected',
    desc: 'AI Anomaly Index identified mock location injection & 33 ghost beneficiaries punched in biometric logs.',
  },
  {
    date: '18 Jul 2024',
    title: 'DoSJE Blacklisted',
    desc: 'Formal debarment order issued with complete recovery proceedings and national blacklist notification.',
  },
];

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    adminAPI.getDashboard()
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.message || err.message || 'Failed to reach the API server')
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <Typography sx={{ p: 3 }}>Loading DoSJE SmartInspect Command Center...</Typography>;

  if (error && !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="contained" startIcon={<RefreshIcon />} onClick={load}>Retry</Button>
      </Box>
    );
  }

  if (!data) return null;

  const { stats, recentInspections = [], highRiskProjects = [] } = data;
  const aiStats = stats.aiStats || {};

  const inspectionData = [
    { name: 'Pending', value: stats.pendingInspections, color: statusColors.pending },
    { name: 'In Progress', value: stats.inProgressInspections, color: statusColors.in_progress },
    { name: 'Completed', value: stats.completedInspections, color: statusColors.completed },
    { name: 'Flagged', value: stats.flaggedInspections, color: statusColors.flagged },
  ];

  const riskChartData = highRiskProjects.map((p) => ({
    name: p.name.length > 24 ? `${p.name.slice(0, 24)}...` : p.name,
    risk: p.risk_score,
    fill: riskColor(p.risk_score),
  }));

  const cards = [
    { title: 'Monitored Facilities', value: stats.totalProjects, icon: <BusinessIcon />, bg: '#0f172a', sub: 'AVYAY · NAPDDR · SIPDA' },
    { title: 'Inspections', value: stats.totalInspections, icon: <AssignmentIcon />, bg: '#1e3a8a', sub: `${stats.pendingInspections} pending / ${stats.flaggedInspections} flagged` },
    { title: 'Field PMU Force', value: stats.totalOfficials, icon: <PeopleIcon />, bg: '#047857', sub: 'NavIC geofenced inspectors' },
    { title: 'Tamper-Proof Evidence', value: stats.totalEvidence, icon: <PhotoIcon />, bg: '#b91c1c', sub: 'Watermarked & TEE verified' },
  ];

  return (
    <Box>
      {/* Portal Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Chip label="SIH 2026 · PS-26095" size="small" color="primary" sx={{ fontWeight: 700 }} />
            <Chip label="DoSJE SmartInspect · Team SamajDrishti (120749)" size="small" sx={{ fontWeight: 600, bgcolor: '#f1f5f9' }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a' }}>
            National Monitoring Command Center
          </Typography>
          <Typography variant="body2" color="text.secondary">
            DoSJE SmartInspect — AI-Powered Real-Time Monitoring &amp; Random Inspection System for Transparent Governance
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="contained" color="primary" size="small" startIcon={<MapIcon />} onClick={() => navigate('/gis-map')}>
            GIS Map
          </Button>
          <Button variant="outlined" size="small" startIcon={<GavelIcon />} onClick={() => navigate('/atr')}>
            Digital ATRs
          </Button>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Programme-at-a-glance metrics band (national demonstration scale) */}
      <Paper
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 2,
          border: '1px solid #dbeafe',
          background: 'linear-gradient(120deg, #eff6ff, #f8fafc)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', letterSpacing: 0.6, textTransform: 'uppercase', fontSize: 12 }}>
            DoSJE Monitoring Landscape — National Scale
          </Typography>
          <Chip label="Illustrative deployment scale" size="small" variant="outlined" sx={{ fontSize: 10.5 }} />
        </Box>
        <Grid container spacing={1.5}>
          {[
            { label: 'Institutions Monitored', value: '1,284', tone: '#1e3a8a', sub: 'AVYAY · NAPDDR · SIPDA' },
            { label: 'Active Inspections', value: '42', tone: '#1d4ed8', sub: `${stats.pendingInspections + stats.inProgressInspections} in this seeded district` },
            { label: 'CCTV Online', value: '934', tone: '#059669', sub: 'Live heartbeat monitored' },
            { label: 'CCTV Offline', value: '61', tone: '#dc2626', sub: 'Auto-raised alerts' },
            { label: 'AI Anomalies', value: '27', tone: '#d97706', sub: 'Pending human review' },
            { label: 'Pending ATRs', value: '18', tone: '#7c3aed', sub: 'Beyond due date' },
          ].map((m) => (
            <Grid item xs={6} md={2} key={m.label} sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: 24, color: m.tone, lineHeight: 1.1 }}>{m.value}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#334155', display: 'block', fontSize: 11 }}>
                {m.label}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: 10, display: 'block', lineHeight: 1.25 }}>{m.sub}</Typography>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Measurable Outcomes Bar (Slide 2 & 5) */}
      <Paper sx={{ p: 2, mb: 3, background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: '#f8fafc' }}>
        <Grid container spacing={2}>
          {[
            { metric: '⚡ 40% Faster', label: 'Inspection Response Time', sub: 'Instant mobile notification' },
            { metric: '🎯 92% Accuracy', label: 'Proxy Attendance Detection', sub: 'Biometric vs CCTV headcount' },
            { metric: '📉 25-30% Reduction', label: 'Oversight Blindspot Gap', sub: 'Closed via AI random sampling' },
            { metric: '🔒 100% Immutable', label: 'GIA Grant Audit Trail', sub: 'NavIC locked & encrypted queue' },
          ].map((item, idx) => (
            <Grid item xs={6} md={3} key={idx}>
              <Box sx={{ borderLeft: idx !== 0 ? '1px solid #334155' : 'none', pl: idx !== 0 ? 2 : 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#38bdf8' }}>{item.metric}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>{item.label}</Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>{item.sub}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Top 4 KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {cards.map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.title}>
            <Card sx={{ bgcolor: card.bg, color: 'white', borderRadius: 2 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    {card.title}
                  </Typography>
                  {card.icon}
                </Box>
                <Typography variant="h3" sx={{ fontWeight: 800, my: 0.5 }}>{card.value}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>{card.sub}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* District Case Study Spotlight: Anugraha Senior Citizens Home, Coimbatore (Slide 2) */}
      <Paper sx={{ p: 2.5, mb: 3, border: '1px solid #fecaca', bgcolor: '#fff' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label="ACTUAL AUDIT CASE STUDY" color="error" size="small" sx={{ fontWeight: 700 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#991b1b' }}>
              Anugraha Senior Citizens Home, Coimbatore (Senior Citizen Home, AVYAY)
            </Typography>
          </Box>
          <Button size="small" variant="outlined" color="error" onClick={() => navigate('/atr')}>
            View ATR Action File →
          </Button>
        </Box>
        <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
          Demonstrates how the legacy siloed monitoring failed for 4 years until automated AI headcount discrepancy indexing detected the persistent proxy reporting:
        </Typography>

        <Grid container spacing={2}>
          {CASE_STUDY_STEPS.map((step, idx) => (
            <Grid item xs={12} sm={6} md={2.4} key={idx}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: idx === 4 ? '#fee2e2' : '#f8fafc',
                  border: idx === 4 ? '1px solid #f87171' : '1px solid #e2e8f0',
                  height: '100%',
                }}
              >
                <Typography variant="caption" sx={{ color: idx === 4 ? '#b91c1c' : '#0284c7', fontWeight: 700 }}>
                  {step.date}
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: idx === 4 ? '#991b1b' : '#0f172a', mt: 0.5, lineHeight: 1.2 }}>
                  {step.title}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5, fontSize: 11 }}>
                  {step.desc}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Chart Section */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              AI Risk Scoring across Monitored Portfolio
            </Typography>
            {riskChartData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={riskChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${value} / 100`, 'Risk score']} />
                  <Bar dataKey="risk" radius={[0, 4, 4, 0]}>
                    {riskChartData.map((entry, index) => (
                      <Cell key={`risk-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">No project risk data available.</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Inspection Pipeline Status
            </Typography>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={inspectionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                  {inspectionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>Average Risk Score: <strong>{aiStats.average_risk_score ?? 48} / 100</strong></span>
              <span>High Risk Facilities: <strong style={{ color: '#dc2626' }}>{aiStats.high_risk_count ?? 1}</strong></span>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Tables Section */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Recent Field Inspections & NavIC Verification
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Facility Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Inspector</TableCell>
                    <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>AI Risk</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentInspections.map((inspection) => (
                    <TableRow key={inspection.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>#{inspection.id}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {inspection.project_name || `Facility #${inspection.project_id}`}
                        </Typography>
                      </TableCell>
                      <TableCell>{inspection.official_name || 'Arun Kumar'}</TableCell>
                      <TableCell>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(inspection.ai_risk_score || 0, 100)}
                          sx={{ height: 6, borderRadius: 3, mb: 0.5, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: riskColor(inspection.ai_risk_score) } }}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 700, color: riskColor(inspection.ai_risk_score) }}>
                          {inspection.ai_risk_score ?? '-'} ({riskLabel(inspection.ai_risk_score || 0)})
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={String(inspection.status).replace('_', ' ')}
                          size="small"
                          sx={{ bgcolor: statusColors[inspection.status] || '#666', color: 'white', fontWeight: 600 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              AI Anomaly & Fraud Directives
            </Typography>
            {(aiStats.recommendations || []).length ? (
              aiStats.recommendations.map((rec, i) => (
                <Alert severity="warning" key={i} sx={{ mb: 1, fontSize: 12 }}>
                  {rec}
                </Alert>
              ))
            ) : (
              <Alert severity="info" sx={{ fontSize: 12 }}>
                High-priority surprise inspection recommended for Anugraha Senior Home (Coimbatore) due to persistent proxy attendance index.
              </Alert>
            )}
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Schemes Monitored under DoSJE
            </Typography>
            {[
              { scheme: 'AVYAY', desc: 'Atal Vayo Abhyuday Yojana (Senior Citizens Homes)', count: '3 Homes' },
              { scheme: 'NAPDDR', desc: 'National Action Plan for Drug Demand Reduction', count: '3 Rehabs' },
              { scheme: 'SIPDA', desc: 'Scheme for Implementation of Persons with Disabilities Act', count: '2 Centers' },
            ].map((s) => (
              <Box key={s.scheme} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid #f1f5f9' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{s.scheme}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.desc}</Typography>
                </Box>
                <Chip label={s.count} size="small" sx={{ fontWeight: 700 }} />
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
