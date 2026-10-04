import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { checkHealth, apiErrorMessage } from '../services/api';

const OFFICIALS = [
  { label: 'Field Officer', id: 'official1@samajdrishti.gov.in', pass: 'Official@123' },
  { label: 'PMU Officer', id: 'supervisor@samajdrishti.gov.in', pass: 'Super@123' },
  { label: 'DoSJE Admin', id: 'admin@samajdrishti.gov.in', pass: 'Admin@123' },
];

const Login = () => {
  const { login } = useAuth();
  const { t, lang, setLang, langs } = useLanguage();
  const [mode, setMode] = useState('password');
  const [identity, setIdentity] = useState('official1@samajdrishti.gov.in');
  const [password, setPassword] = useState('Official@123');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [serverDown, setServerDown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkHealth(5000)
      .then(() => { if (!cancelled) setServerDown(false); })
      .catch(() => { if (!cancelled) setServerDown(true); });
    return () => { cancelled = true; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (mode === 'password') {
      if (!identity.trim()) { setError('Enter your official ID or email.'); return; }
      if (!password) { setError('Enter your password.'); return; }
    }
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
        if (otp.length !== 6) { setError('Enter the 6-digit OTP sent to your mobile.'); return; }
        setNotice('Demo OTP accepted.');
        await login('official1@samajdrishti.gov.in', 'Official@123');
        return;
      }
      await login(identity.trim(), password);
    } catch (err) {
      setError(apiErrorMessage(err, 'Sign-in failed. Check your official ID and password.'));
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (o) => {
    setMode('password');
    setIdentity(o.id);
    setPassword(o.pass);
    setError('');
  };

  return (
    <div className="auth">
      <div className="auth-container">
        <div className="auth-logo">🛡️</div>
        <div className="auth-title">Samaj Drishti</div>
        <div className="auth-sub">{t('login.dept')}</div>
        <div className="auth-sub" style={{ marginTop: -14, fontWeight: 700, letterSpacing: 1.1, textTransform: 'uppercase', fontSize: 11 }}>
          {t('login.portal')}
        </div>

        <div className="row center" style={{ justifyContent: 'center', gap: 6, marginBottom: 12 }} role="group" aria-label="Language">
          {langs.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLang(l.id)}
              aria-pressed={lang === l.id}
              style={{
                border: '1px solid rgba(255,255,255,0.4)', borderRadius: 999, padding: '4px 12px',
                background: lang === l.id ? '#fff' : 'transparent', color: lang === l.id ? 'var(--navy)' : '#fff',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {l.label}
            </button>
          ))}
        </div>

        <form className="auth-card" onSubmit={submit} noValidate>
          {serverDown ? (
            <div className="alert alert-warn" role="status">
              {t('login.backendDown')}
            </div>
          ) : null}
          {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
          {notice ? <div className="alert alert-info" role="status">{notice}</div> : null}

          <label className="field">
            <span className="field-label">{t('login.id')}</span>
            <input
              className="input"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              placeholder="name@dosje.gov.in"
              autoComplete="username"
              required
            />
          </label>

          {mode === 'password' ? (
            <div className="field">
              <label className="field-label" htmlFor="login-password">{t('login.password')}</label>
              <div className="password-wrap">
                <input
                  id="login-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('login.hide') : t('login.show')}
                  aria-pressed={showPassword}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          ) : (
            <label className="field">
              <span className="field-label">{t('login.otpLabel')}</span>
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
            {busy ? <span className="spinner" /> : mode === 'otp' ? (otpSent ? t('login.verifyOtp') : t('login.sendOtp')) : t('login.signin')}
          </button>

          <div className="center mt">
            <button
              type="button"
              className="auth-link"
              onClick={() => { setMode(mode === 'password' ? 'otp' : 'password'); setError(''); setNotice(''); }}
              style={{ fontSize: 12.5 }}
            >
              {mode === 'password' ? t('login.useOtp') : t('login.usePassword')}
            </button>
          </div>

          <div className="center mt">
            <Link to="/register" className="auth-link" style={{ fontSize: 12.5 }}>
              {t('login.newOfficer')}
            </Link>
          </div>

          <div className="divider" />
          <div className="tiny muted center" style={{ marginBottom: 6 }}>{t('login.demo')}</div>
          <div className="demo-row">
            {OFFICIALS.map((o) => (
              <button key={o.label} type="button" className="demo-btn" onClick={() => fillDemo(o)}>
                {o.label}
              </button>
            ))}
          </div>
        </form>

        <div className="auth-footer">
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('login.secure')}</div>
          <div className="tiny" style={{ opacity: 0.78, marginTop: 6, lineHeight: 1.6 }}>
            🔒 {t('login.secureSub')}
            <br />
            SIH 2026 · Problem Statement 26095
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
