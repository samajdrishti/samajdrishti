import React from 'react';
import { Box, Typography, Paper, Grid, Chip, Alert, Divider, Button } from '@mui/material';
import {
  Casino as AssignIcon,
  LocationOn as GpsIcon,
  Videocam as VcIcon,
  PhotoCamera as EvidenceIcon,
  FactCheck as ChecklistIcon,
  Psychology as AiIcon,
  Send as ReportIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  {
    icon: <AssignIcon />,
    title: '1 · Randomised Allotment',
    tone: '#1e3a8a',
    body: 'A risk-weighted random engine picks the facility and the field officer. The duty notification is pushed instantly to the officer and logged as an immutable audit event.',
  },
  {
    icon: <GpsIcon />,
    title: '2 · GPS Geofence Verification',
    tone: '#0369a1',
    body: 'The officer must physically reach the site. A NavIC/GPS reading matched inside the facility geofence (default 250 m) is mandatory before the inspection opens.',
  },
  {
    icon: <VcIcon />,
    title: '3 · Random Video Check',
    tone: '#4f46e5',
    body: 'A live one-way video confirmation runs at a random moment, cross-checking attendance, registers, kitchen and CCTV feeds with an AI-picked verification question.',
  },
  {
    icon: <EvidenceIcon />,
    title: '4 · Geo-tagged, Tamper-Evident Evidence',
    tone: '#7c3aed',
    body: 'Every photo or video is captured with GPS coordinates and a digital watermark. Each file carries a tamper-evidence encryption (TEE) hash recorded in the vault.',
  },
  {
    icon: <ChecklistIcon />,
    title: '5 · Standard Verification Checklist',
    tone: '#059669',
    body: 'The officer completes the 24-point DoSJE checklist across infrastructure, services, documentation, safety, governance and scheme compliance.',
  },
  {
    icon: <AiIcon />,
    title: '6 · AI-Assisted Anomaly Analysis',
    tone: '#d97706',
    body: 'The engine cross-indexes attendance, CCTV silence, patterns and documentation gaps to surface an anomaly index. Every AI indicator requires an officer\u2019s explicit confirm / dismiss decision.',
  },
  {
    icon: <ReportIcon />,
    title: '7 · Secure Report to the Command Center',
    tone: '#b91c1c',
    body: 'The digitally signed report, evidence and audit trail are transmitted to the Central Monitoring System and pushed live to this dashboard. ATR tracking starts immediately.',
  },
];

const Procedure = () => {
  const navigate = useNavigate();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h4">Field Inspection Procedure</Typography>
          <Typography variant="body2" color="text.secondary">
            The exact 7-step flow every inspection officer follows. No decision is ever taken by AI alone.
          </Typography>
        </Box>
        <Chip label="PS 26095 · FIELD PROCEDURE" color="primary" size="small" sx={{ fontWeight: 700 }} />
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>Human-in-the-loop guarantee:</strong> the AI engine allocates, verifies location feasibility, records the video
        check and <em>suggests</em> anomalies — but compliance scoring, evidence acceptance and the final report are
        always concluded by the inspecting officer.
      </Alert>

      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {STEPS.map((step, idx) => (
            <Paper
              key={step.title}
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2.5,
                borderColor: 'divider',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                  borderColor: step.tone,
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box
                  sx={{
                    bgcolor: step.tone,
                    color: '#fff',
                    borderRadius: 2,
                    width: 40,
                    height: 40,
                    minWidth: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 2px 8px ${step.tone}40`,
                  }}
                >
                  {step.icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: step.tone, mb: 0.5 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6 }}>
                    {step.body}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      </Paper>

      <Divider sx={{ my: 3 }} />

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: '#0f172a' }}>
              Guards built into the process
            </Typography>
            {[
              'Geofence failure = inspection cannot open.',
              'Geo-verification on every status change and evidence capture.',
              'Video check verifies attendance live against the register.',
              'Evidence hashes are append-only and verifiable later.',
              'Anomalies expire unless an officer confirms or dismisses them.',
            ].map((point) => (
              <Typography key={point} variant="body2" sx={{ color: '#334155', py: 0.6, display: 'flex', gap: 1.2, alignItems: 'center' }}>
                <span style={{ color: '#059669', fontWeight: 800, fontSize: 16 }}>✓</span>
                {point}
              </Typography>
            ))}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.5, bgcolor: '#0f233f', color: '#dbe7f5', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: '#fff' }}>
              See it working live
            </Typography>
            <Typography variant="body2" sx={{ color: '#a9c4e2', mb: 2, lineHeight: 1.6 }}>
              Open the Field Inspections module, pick any row, and inspect the completed dossier — status
              timeline, geo-verification, evidence vault, checklist and the officer's AI decisions are all recorded there.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/inspections')}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: '#2563eb',
                '&:hover': { bgcolor: '#1d4ed8' },
              }}
            >
              Open Field Inspections →
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Procedure;