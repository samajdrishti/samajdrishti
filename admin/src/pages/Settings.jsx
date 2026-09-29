import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Switch, FormControlLabel, TextField, Button, Divider,
  Chip, Alert, Stack, CircularProgress,
} from '@mui/material';
import { adminAPI } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const Settings = () => {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState('');

  const checkAI = useCallback(async () => {
    setChecking(true);
    try {
      const { data } = await adminAPI.getAIStatus();
      setStatus(data);
      setCheckedAt(new Date().toLocaleTimeString('en-IN'));
    } catch (err) {
      setStatus({
        aiEngine: { online: false, url: 'http://localhost:5001', error: err.message },
        dataMode: 'unknown',
      });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAI();
  }, [checkAI]);

  const aiOnline = Boolean(status?.aiEngine?.online);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>System Settings</Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Runtime Status</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`Data store: ${status?.dataMode === 'postgres' ? 'PostgreSQL' : 'In-memory demo'}`}
            color={status?.dataMode === 'postgres' ? 'success' : 'default'}
            size="small"
          />
          <Chip
            label={aiOnline ? 'AI engine online' : 'AI engine offline'}
            color={aiOnline ? 'success' : 'error'}
            size="small"
          />
          {checkedAt && <Chip label={`Last checked ${checkedAt}`} size="small" variant="outlined" />}
        </Stack>

        {status?.aiEngine && (
          <Alert severity={aiOnline ? 'success' : 'error'}>
            <Typography variant="body2">
              <strong>AI engine:</strong> {status.aiEngine.url}
            </Typography>
            {aiOnline && (
              <>
                <Typography variant="body2">
                  <strong>Anomaly backend:</strong> {status.aiEngine.anomaly_backend || 'n/a'}
                </Typography>
                <Typography variant="body2">
                  <strong>Capabilities:</strong> {(status.aiEngine.capabilities || []).join(', ')}
                </Typography>
              </>
            )}
            {!aiOnline && (
              <Typography variant="body2">
                Start it with: <code>cd ai-engine &amp;&amp; .venv\Scripts\python.exe app.py</code>
              </Typography>
            )}
          </Alert>
        )}

        <Button
          variant="outlined"
          sx={{ mt: 2 }}
          onClick={checkAI}
          disabled={checking}
          startIcon={checking ? <CircularProgress size={16} /> : null}
        >
          {checking ? 'Testing...' : 'Test connection'}
        </Button>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6">Notification Settings</Typography>
        <FormControlLabel control={<Switch defaultChecked />} label="Email Notifications" />
        <FormControlLabel control={<Switch defaultChecked />} label="SMS Alerts for High Risk" />
        <FormControlLabel control={<Switch />} label="Video Call Notifications" />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6">AI Engine Settings</Typography>
        <FormControlLabel control={<Switch defaultChecked />} label="Anomaly Detection" />
        <FormControlLabel control={<Switch defaultChecked />} label="Risk Scoring" />
        <FormControlLabel control={<Switch defaultChecked />} label="Random Assignment" />
        <Divider sx={{ my: 2 }} />
        <TextField label="Risk Threshold %" type="number" defaultValue={70} fullWidth margin="normal" />
        <TextField
          label="AI Engine URL"
          value={status?.aiEngine?.url || 'http://localhost:5001'}
          fullWidth
          margin="normal"
          InputProps={{ readOnly: true }}
        />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6">API Settings</Typography>
        <TextField
          label="API URL"
          value={API_URL}
          fullWidth
          margin="normal"
          InputProps={{ readOnly: true }}
        />
        <TextField
          label="JWT Secret"
          type="password"
          value="configured-in-backend-env"
          fullWidth
          margin="normal"
          InputProps={{ readOnly: true }}
        />
      </Paper>

      <Button variant="contained" color="primary">Save Settings</Button>
    </Box>
  );
};

export default Settings;

