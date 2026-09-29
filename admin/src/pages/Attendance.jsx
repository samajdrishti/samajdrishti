import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Alert, Button, LinearProgress, Grid, CircularProgress,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { attendanceAPI } from '../services/api';

const Attendance = () => {
  const [summary, setSummary] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await attendanceAPI.summary();
      setSummary(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load attendance data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAnalysis = async () => {
    setAnalysing(true);
    setError('');
    try {
      const { data } = await attendanceAPI.anomalies();
      setAnomalies(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Attendance analysis failed.');
    } finally {
      setAnalysing(false);
    }
  };

  const officials = summary?.officials || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4">Attendance &amp; Analytics</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button size="small" variant="contained" onClick={runAnalysis} disabled={analysing}>
            {analysing ? 'Analysing…' : '🤖 Run AI attendance analysis'}
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={26} /></Box>}

      {summary && (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              { label: 'Officials', value: summary.totals.officials },
              { label: 'Present today', value: summary.totals.present_today },
              { label: 'Late logins (14d)', value: summary.totals.late_days },
              { label: 'Geo mismatches', value: summary.totals.geo_mismatches },
            ].map((stat) => (
              <Grid item xs={6} md={3} key={stat.label}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4">{stat.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Official-wise attendance</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Official</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell align="right">Present</TableCell>
                    <TableCell align="right">Late</TableCell>
                    <TableCell align="right">Missing punch</TableCell>
                    <TableCell align="right">Geo mismatch</TableCell>
                    <TableCell style={{ minWidth: 150 }}>Punctuality</TableCell>
                    <TableCell>Today</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {officials.map((official) => (
                    <TableRow key={official.official_id}>
                      <TableCell>{official.name}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{official.department || '—'}</TableCell>
                      <TableCell align="right">{official.days_present}</TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={official.late_days}
                          color={official.late_days > 3 ? 'error' : official.late_days ? 'warning' : 'success'}
                        />
                      </TableCell>
                      <TableCell align="right">{official.missing_punches}</TableCell>
                      <TableCell align="right">
                        {official.geo_mismatches ? (
                          <Chip size="small" label={official.geo_mismatches} color="error" />
                        ) : (
                          0
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={official.punctuality_pct}
                            sx={{ flex: 1, height: 7, borderRadius: 4 }}
                            color={official.punctuality_pct > 80 ? 'success' : official.punctuality_pct > 50 ? 'warning' : 'error'}
                          />
                          <Typography variant="caption">{official.punctuality_pct}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={official.checked_in_today ? 'in' : 'out'}
                          color={official.checked_in_today ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      {anomalies && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            AI irregularity report ({anomalies.irregularities.length} finding(s) from {anomalies.records_analyzed} punches)
          </Typography>
          {!anomalies.irregularities.length && (
            <Typography variant="body2" color="text.secondary">No irregularities detected.</Typography>
          )}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Official</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell align="right">Confidence</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {anomalies.irregularities.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>#{item.official_id}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{String(item.type).replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={item.severity}
                        color={item.severity === 'high' ? 'error' : item.severity === 'medium' ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{item.details}</TableCell>
                    <TableCell align="right">{Math.round(item.confidence * 100)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default Attendance;

