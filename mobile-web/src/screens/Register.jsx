import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const EMPTY = { name: '', email: '', password: '', department: '', phone: '', role: 'official' };

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name || !form.email || form.password.length < 6) {
      setError('Name, a valid email and a 6+ character password are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-logo">🧾</div>
      <div className="auth-title">Create account</div>
      <div className="auth-sub">For DoSJE field officials, PMU teams and supervisors</div>

      <div className="auth-card">
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <label className="field">
            <span className="field-label">Full name</span>
            <input className="input" value={form.name} onChange={update('name')} autoComplete="name" />
          </label>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
            />
          </label>
          <label className="field">
            <span className="field-label">Password (6+ characters)</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
            />
          </label>
          <label className="field">
            <span className="field-label">Department</span>
            <input
              className="input"
              value={form.department}
              onChange={update('department')}
              placeholder="e.g. Public Works"
            />
          </label>
          <label className="field">
            <span className="field-label">Phone</span>
            <input className="input" inputMode="tel" value={form.phone} onChange={update('phone')} />
          </label>
          <label className="field">
            <span className="field-label">Role</span>
            <select className="input" value={form.role} onChange={update('role')}>
              <option value="official">Field official</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </label>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : 'Create account'}
          </button>
        </form>
      </div>

      <div className="auth-footer">
        Already registered?{' '}
        <button type="button" className="auth-link" onClick={() => navigate('/')}>
          Sign in
        </button>
      </div>
    </div>
  );
};

export default Register;
