import React from 'react';

/* Shared primitives for DoSJE SmartInspect. Status colour is the only accent that
   carries meaning, so every component reads from the same four tones. */

export const TONE = {
  ok: 'ok',
  warn: 'warn',
  bad: 'bad',
  info: 'info',
  mute: 'mute',
};

export const Chip = ({ tone = 'mute', dot, children }) => (
  <span className={`g-chip g-${tone}`}>
    {dot ? <i className="g-chip-dot" /> : null}
    {children}
  </span>
);

/** Maps a domain status string onto the shared status language. */
export const toneFor = (status) => {
  const s = String(status || '').toLowerCase();
  if (['verified', 'online', 'completed', 'ok', 'closed', 'active', 'connected', 'submitted', 'synced'].includes(s)) return 'ok';
  if (['pending', 'review', 'warning', 'issue', 'assigned', 'accepted', 'medium', 'scheduled'].includes(s)) return 'warn';
  if (['critical', 'offline', 'escalated', 'flagged', 'suspicious', 'failed', 'mismatch', 'high'].includes(s)) return 'bad';
  if (['in_progress', 'in progress', 'live', 'info', 'information', 'low', 'new'].includes(s)) return 'info';
  return 'mute';
};

export const StatusChip = ({ status, dot = true }) => (
  <Chip tone={toneFor(status)} dot={dot}>{String(status || '—').replace(/_/g, ' ')}</Chip>
);

export const Panel = ({ title, aside, children, pad = true, className = '' }) => (
  <section className={`g-panel ${className}`}>
    {title ? (
      <header className="g-panel-hd">
        <h2 className="g-h2">{title}</h2>
        {aside || null}
      </header>
    ) : null}
    <div className={pad ? 'g-panel-bd' : ''}>{children}</div>
  </section>
);

export const SectionTitle = ({ children, aside }) => (
  <div className="g-sec">
    <span className="g-sec-title">{children}</span>
    {aside ? <span className="g-sec-aside">{aside}</span> : null}
  </div>
);

export const KV = ({ k, v, mono }) => (
  <div className="g-kv">
    <span className="g-kv-k">{k}</span>
    <span className={`g-kv-v${mono ? ' g-mono' : ''}`}>{v}</span>
  </div>
);

export const Kpis = ({ items }) => (
  <div className="g-kpis">
    {items.map((i) => (
      <div key={i.label} className={`g-kpi ${i.tone || ''}`}>
        <div className="g-kpi-n">{i.value}</div>
        <div className="g-kpi-l">{i.label}</div>
      </div>
    ))}
  </div>
);

export const StatStrip = ({ items }) => (
  <div className="g-strip">
    {items.map((i) => (
      <div key={i.label}>
        <div className="g-strip-n" style={{ color: i.color }}>{i.value}</div>
        <div className="g-strip-l">{i.label}</div>
      </div>
    ))}
  </div>
);

export const Bar = ({ pct, tone = '' }) => (
  <div className={`g-bar ${tone}`}>
    <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
  </div>
);

export const Note = ({ tone = 'info', icon, children }) => (
  <div className={`g-note ${tone}`}>
    <span className="g-note-ico">{icon || (tone === 'ok' ? '✓' : tone === 'bad' ? '!' : tone === 'warn' ? '▲' : 'i')}</span>
    <span>{children}</span>
  </div>
);

const STEP_TONE = { done: 'ok', active: 'info', todo: 'mute' };

export const Steps = ({ steps }) => (
  <div className="g-steps">
    {steps.map((s, i) => (
      <div key={s.title} className={`g-step ${STEP_TONE[s.state]}`}>
        <div className="g-step-rail">
          <div className="g-step-dot">{s.state === 'done' ? '✓' : i + 1}</div>
          {i < steps.length - 1 ? <div className="g-step-line" /> : null}
        </div>
        <div className="g-step-body">
          <div className="g-step-t">{s.title}</div>
          {s.detail ? <div className="g-step-d">{s.detail}</div> : null}
        </div>
      </div>
    ))}
  </div>
);

export const Timeline = ({ items }) => (
  <div className="g-tl">
    {items.map((it, i) => (
      <div key={`${it.title}-${i}`} className={`g-tl-item ${it.tone || 'ok'}`}>
        <div className="g-tl-t">{it.title}</div>
        {it.meta ? <div className="g-tl-m">{it.meta}</div> : null}
      </div>
    ))}
  </div>
);

const PIN_COLOR = { ok: '#15803d', info: '#1d4ed8', warn: '#b45309', bad: '#b91c1c' };

/**
 * Offline-safe map surface. Pins are positioned in percentages against a synthetic
 * base layer, so the demo needs no tile server and never leaks coordinates to a
 * third party.
 */
export const MapView = ({ pins = [], route, height = 190, label = 'Base map · simulated', children }) => (
  <div className="g-map" style={{ height }}>
    <div className="g-map-grid" />
    <div className="g-map-river" style={{ left: '-10%', top: '58%', width: '130%', height: 16, transform: 'rotate(-7deg)' }} />
    <div className="g-map-road" style={{ left: '-5%', top: '32%', width: '110%', height: 7 }} />
    <div className="g-map-road" style={{ left: '18%', top: '-5%', width: 7, height: '115%' }} />
    <div className="g-map-road" style={{ left: '0%', top: '76%', width: '100%', height: 5 }} />
    <div className="g-map-block" style={{ left: '24%', top: '8%', width: 34, height: 20 }} />
    <div className="g-map-block" style={{ left: '62%', top: '12%', width: 28, height: 16 }} />
    <div className="g-map-block" style={{ left: '30%', top: '62%', width: 40, height: 18 }} />
    <div className="g-map-block" style={{ left: '70%', top: '60%', width: 30, height: 22 }} />
    {route ? (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <line
          x1={route.from.x} y1={route.from.y} x2={route.to.x} y2={route.to.y}
          stroke="#1d4ed8" strokeWidth="0.9" strokeDasharray="3 2" strokeLinecap="round" opacity="0.85"
        />
      </svg>
    ) : null}
    {pins.map((p, i) => (
      <div key={`${p.label}-${i}`} className="g-map-pin" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
        <span className="g-pulse" style={{ width: 18, height: 18, borderRadius: '50%', background: PIN_COLOR[p.tone || 'ok'], position: 'absolute', top: 0, left: -8 }} />
        <svg width="20" height="24" viewBox="0 0 20 24" aria-hidden="true">
          <path d="M10 0C4.5 0 0 4.4 0 9.9 0 17 10 24 10 24s10-7 10-14.1C20 4.4 15.5 0 10 0z" fill={PIN_COLOR[p.tone || 'ok']} />
          <circle cx="10" cy="9.6" r="3.4" fill="#fff" />
        </svg>
        {p.label ? <span className="g-map-label">{p.label}</span> : null}
      </div>
    ))}
    {children}
    <span className="g-map-scale">{label}</span>
    <div className="g-map-zoom">
      <button type="button" aria-label="Zoom in">+</button>
      <button type="button" aria-label="Zoom out">−</button>
    </div>
  </div>
);

export const FilterRow = ({ options, value, onChange }) => (
  <div className="g-filter-row">
    {options.map((o) => (
      <button key={o} type="button" className={`g-filter ${o === value ? 'on' : ''}`} onClick={() => onChange(o)}>
        {o}
      </button>
    ))}
  </div>
);

export const Empty = ({ icon = '🗂️', title, desc }) => (
  <div className="g-empty">
    <div className="g-empty-ic">{icon}</div>
    <div className="g-empty-t">{title}</div>
    {desc ? <div className="g-empty-d">{desc}</div> : null}
  </div>
);

export const Tabs = ({ options, value, onChange }) => (
  <div className="g-tabs">
    {options.map((o) => (
      <button key={o} type="button" className={o === value ? 'on' : ''} onClick={() => onChange(o)}>
        {o}
      </button>
    ))}
  </div>
);

export const TopBar = ({ title, subtitle, onBack, right }) => (
  <div className="g-topbar">
    {onBack ? (
      <button type="button" className="g-topbar-btn" onClick={onBack} aria-label="Back">‹</button>
    ) : null}
    <div className="grow">
      <div className="g-topbar-t">{title}</div>
      {subtitle ? <div className="g-topbar-s">{subtitle}</div> : null}
    </div>
    {right || null}
  </div>
);
