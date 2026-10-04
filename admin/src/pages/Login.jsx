import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, Alert, Chip, Divider } from '@mui/material';
import { authAPI, saveSession } from '../services/api';

// Demo shortcuts are a development convenience only - never ship credentials
// in a production bundle.
const DEMO_ACCOUNTS = import.meta.env.DEV
  ? [
      { label: 'Admin', email: 'admin@samajdrishti.gov.in', password: 'Admin@123' },
      { label: 'Supervisor', email: 'supervisor@samajdrishti.gov.in', password: 'Super@123' },
    ]
  : [];

const Login = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const authenticate = async (loginEmail, loginPassword) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.login(loginEmail, loginPassword);

      if (!['admin', 'supervisor'].includes(data.user.role)) {
        setError(`Signed in as "${data.user.role}". This dashboard is limited to admin / supervisor accounts.`);
        return;
      }

      saveSession({ token: data.token, user: data.user });
      if (onAuthenticated) onAuthenticated(data.user);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Login failed. Confirm the API server is running on http://localhost:5000'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    authenticate(email, password);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#2c3e50',
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, width: '100%', maxWidth: 460, borderRadius: 3 }} elevation={8}>
        <Box sx={{ textAlign: 'center', mb: 2.5 }}>
          <Box sx={{ fontSize: 40, lineHeight: 1 }}>🛡️</Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, letterSpacing: -0.02 }}>
            Samaj Drishti
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 500, fontSize: '1.1rem', color: '#64748b', mt: 0.5 }}>
            Command Center
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            National Monitoring Command Center
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Ministry of Social Justice &amp; Empowerment · SIH 2026 · PS 26095
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            sx={{ mt: 2 }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </Box>

        <Divider sx={{ my: 3 }}>Demo Accounts</Divider>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
          {DEMO_ACCOUNTS.map((account) => (
            <Chip
              key={account.label}
              label={account.label}
              variant="outlined"
              clickable
              disabled={loading}
              onClick={() => {
                setEmail(account.email);
                setPassword(account.password);
                authenticate(account.email, account.password);
              }}
            />
          ))}
        </Box>
      </Paper>
    </Box>
  );
};

export default Login;
