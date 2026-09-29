import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { checkHealth, authAPI, apiErrorMessage } from '../services/api';

const OFFICIALS = [
  { label: 'Field Officer', id: 'official1@samajdrishti.gov.in', pass: 'Official@123' },
  { label: 'PMU Officer', id: 'supervisor@samajdrishti.gov.in', pass: 'Super@123' },
  { label: 'DoSJE Admin', id: 'admin@samajdrishti.gov.in', pass: 'Admin@123' },
];

const Login = () => {
  const { login } = useAuth();
  const [mode, setMode] = useState('password');
  const [identity, setIdentity] = useState('official1@samajdrishti.gov.in');
  const [password, setPassword] = useState('Official@123');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'otp') {
        if (!otpSent) {
          const res = await checkHealth(5000).catch(() => ({ data: { status: 'ok' } }));
          setOtpSent(true);
          setNotice(res?.data?.dataMode === 'memory'
            ? 'Demo OTP 4 8 1 2 issued to the registered mobile.'
            : 'OTP sent to the registered mobile number.');
          return;
        }
        setNotice('Demo OTP accepted.');
        await login('official1@samajdrishti.gov.in', 'Official@123');
        return;
      }
      await login(identity, password);
    } catch (err) {
      setError(apiErrorMessage(err, 'Sign-in failed. Check your official ID and password.'));
    } finally {
      setBusy(false);
    }
  };

  const useDemo = (o) => {
    setMode('password');
    setIdentity(o.id);
    setPassword(o.pass);
    setError('');
  };

  return (
    <div className="auth">
      <div className="auth-container">
        <div className="auth-logo">🛡️</div>
        <div className="auth-title">DoSJE SmartInspect</div>
        <div className="auth-sub">Department of Social Justice &amp; Empowerment</div>
        <div className="auth-sub" style={{ marginTop: -14, fontWeight: 700, letterSpacing: 1.1, textTransform: 'uppercase', fontSize: 11 }}>
          Field Inspection Portal
        </div>

        <form className="auth-card" onSubmit={submit}>
          {error ? <div className="alert alert-error">{error}</div> : null}
          {notice ? <div className="alert alert-info">{notice}</div> : null}

          <label className="field">
            <span className="field-label">Official ID / Mobile number</span>
            <input
              className="input"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              placeholder="name@dosje.gov.in"
              autoComplete="username"
            />
          </label>

          {mode === 'password' ? (
            <label className="field">
              <span className="field-label">Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
          ) : (
            <label className="field">
              <span className="field-label">One-time password (6 digits)</span>
              <input
                className="input g-mono"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
              />
            </label>
          )}

          <button className="btn" type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : mode === 'otp' ? (otpSent ? 'Verify & sign in' : 'Send OTP') : 'Sign in to Field Portal'}
          </button>

          <div className="center mt">
            <button
              type="button"
              className="auth-link"
              onClick={() => { setMode(mode === 'password' ? 'otp' : 'password'); setError(''); setNotice(''); }}
              style={{ fontSize: 12.5 }}
            >
              {mode === 'password' ? 'Sign in with OTP instead' : 'Use official ID and password'}
            </button>
          </div>

          <div className="divider" />
          <div className="tiny muted center" style={{ marginBottom: 6 }}>Demo officer profiles</div>
          <div className="demo-row">
            {OFFICIALS.map((o) => (
              <button key={o.label} type="button" className="demo-btn" onClick={() => useDemo(o)}>
                {o.label}
              </button>
            ))}
          </div>
        </form>

        <div className="auth-footer">
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>Secure Government Monitoring System</div>
          <div className="tiny" style={{ opacity: 0.78, marginTop: 6, lineHeight: 1.6 }}>
            🔒 End-to-end encrypted session · Government of India
            <br />
            SIH 2026 · Problem Statement 26095
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
