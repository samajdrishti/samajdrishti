import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* Shared primitives for Samaj Drishti. Status colour is the only accent that
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

const PIN_COLOR = { ok: '#15803d', info: '#1d4ed8', warn: '#b45309', bad: '#b91c1c', mute: '#64748b' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const validLatLng = (p) =>
  p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) &&
  Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lng)) <= 180;

/** Teardrop marker in the shared status colour, with an optional label tag. */
const pinIcon = (pin) => {
  const color = PIN_COLOR[pin.tone || 'ok'] || PIN_COLOR.ok;
  return L.divIcon({
    className: 'sd-pin',
    html:
      `<svg width="26" height="32" viewBox="0 0 20 24" aria-hidden="true">` +
      `<path d="M10 0C4.5 0 0 4.4 0 9.9 0 17 10 24 10 24s10-7 10-14.1C20 4.4 15.5 0 10 0z" fill="${color}"/>` +
      `<circle cx="10" cy="9.6" r="3.4" fill="#fff"/></svg>` +
      (pin.label ? `<span class="sd-pin-label">${esc(pin.label)}</span>` : ''),
    iconSize: [26, 32],
    iconAnchor: [13, 32],
    popupAnchor: [0, -30],
  });
};

const popupHtml = (pin, index) => {
  const info = pin.popupContent || pin.info;
  const scheme = pin.scheme || pin.program;
  let html = '<div class="sd-pop">';
  if (pin.label) html += `<div class="sd-pop-title">${esc(pin.label)}</div>`;
  if (info) html += `<div class="sd-pop-info">${esc(info)}</div>`;
  if (scheme) html += `<div class="sd-pop-scheme">${esc(scheme)}${pin.description ? `<div class="sd-pop-desc">${esc(pin.description)}</div>` : ''}</div>`;
  if (pin.phone || pin.hasCall) {
    html += `<a class="sd-pop-btn sd-pop-call" href="tel:${esc(pin.phone || '')}">Call</a>`;
  }
  if (pin.hasVideo || pin.videoUrl) {
    html += `<button type="button" class="sd-pop-btn sd-pop-video" data-pin="${index}" data-pin-act="video">Video Call</button>`;
  }
  (pin.actions || []).forEach((a, i) => {
    html += `<button type="button" class="sd-pop-btn" data-pin="${index}" data-pin-act="custom-${i}">${esc(a.icon || '')} ${esc(a.label || '')}</button>`;
  });
  html += '</div>';
  return html;
};

const hasPopup = (p) =>
  Boolean(p.popupContent || p.info || p.scheme || p.program || p.phone || p.hasCall || p.hasVideo || p.videoUrl || (p.actions && p.actions.length));

/**
 * Real OpenStreetMap surface (Leaflet). Pins and routes take real {lat, lng}.
 * Tiles need internet — offline the area stays blank and a chip says so.
 */
export const MapView = ({ pins = [], route, height = 190, label = 'OpenStreetMap', center, zoom = 15, fit, fitKey, onPinClick, onCall, onVideoCall, children }) => {
  const mountRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const routeRef = useRef(null);
  const propsRef = useRef({ pins, onPinClick, onCall, onVideoCall });
  propsRef.current = { pins, onPinClick, onCall, onVideoCall };
  const [tilesDown, setTilesDown] = useState(false);

  // Create once; destroy on unmount (StrictMode-safe: Leaflet clears the container id).
  useEffect(() => {
    const el = mountRef.current;
    if (!el || mapRef.current) return undefined;
    const map = L.map(el, { zoomControl: true, attributionControl: true });
    map.attributionControl.setPrefix(false);
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    tiles.on('tileerror', () => setTilesDown(true));
    tiles.on('tileload', () => setTilesDown(false));
    tiles.addTo(map);
    mapRef.current = map;

    const onContainerClick = (e) => {
      const btn = e.target.closest && e.target.closest('[data-pin-act]');
      if (!btn) return;
      const { pins: live, onVideoCall: liveVideo } = propsRef.current;
      const pin = live[Number(btn.dataset.pin)];
      if (!pin) return;
      const act = btn.dataset.pinAct;
      if (act === 'video') {
        if (pin.onVideoCall) pin.onVideoCall(pin);
        else if (liveVideo) liveVideo(pin);
        else if (pin.videoUrl) window.open(pin.videoUrl, '_blank', 'noopener');
      } else if (act.startsWith('custom-')) {
        const action = (pin.actions || [])[Number(act.slice(7))];
        if (action && action.onClick) action.onClick(pin);
      }
    };
    el.addEventListener('click', onContainerClick);

    const initial = propsRef.current.pins.filter(validLatLng);
    // `fit` overrides the initial framing (e.g. GPS screen frames device +
    // institution tightly while still plotting every other center for panning).
    const frame = Array.isArray(fit) && fit.filter(validLatLng).length ? fit.filter(validLatLng) : initial;
    if (frame.length > 1) {
      map.fitBounds(L.latLngBounds(frame.map((p) => [Number(p.lat), Number(p.lng)])), { padding: [36, 36] });
    } else if (frame.length === 1) {
      map.setView([Number(frame[0].lat), Number(frame[0].lng)], zoom);
    } else if (initial.length === 1) {
      map.setView([Number(initial[0].lat), Number(initial[0].lng)], zoom);
    } else if (center && Number.isFinite(Number(center[0]))) {
      map.setView([Number(center[0]), Number(center[1])], zoom);
    } else {
      map.setView([11.0168, 76.9558], 12); // Coimbatore fallback
    }

    return () => {
      el.removeEventListener('click', onContainerClick);
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
      routeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers + route in place (no refit — live GPS fixes must not yank the user's zoom).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const { onPinClick: liveClick } = propsRef.current;
    pins.filter(validLatLng).forEach((p) => {
      const marker = L.marker([Number(p.lat), Number(p.lng)], { icon: pinIcon(p), keyboard: true, title: p.label || 'Map pin' });
      if (hasPopup(p)) marker.bindPopup(popupHtml(p, pins.indexOf(p)), { maxWidth: 260, closeButton: true });
      marker.on('click', () => {
        if (liveClick) liveClick(p);
        if (p.onClick) p.onClick(p);
      });
      marker.addTo(map);
      markersRef.current.push(marker);
      if (p.open || p.showPopup || p.active) {
        setTimeout(() => marker.openPopup(), 300);
      }
    });
    if (routeRef.current) { routeRef.current.remove(); routeRef.current = null; }
    if (route && validLatLng(route.from) && validLatLng(route.to)) {
      routeRef.current = L.polyline(
        [[Number(route.from.lat), Number(route.from.lng)], [Number(route.to.lat), Number(route.to.lng)]],
        { color: '#1d4ed8', weight: 3, opacity: 0.85, dashArray: '8 8' }
      ).addTo(map);
    }
  }, [pins, route, onPinClick]);

  // Explicit reframe signal (e.g. the directory finished loading after mount).
  // Deliberately separate from the sync effect so live GPS fixes never refit.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitKey == null) return;
    const pts = pins.filter(validLatLng);
    if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts.map((p) => [Number(p.lat), Number(p.lng)])), { padding: [36, 36] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <div className="sd-map" style={{ position: 'relative', height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} role="application" aria-label="Map showing inspection locations" />
      {tilesDown ? (
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 500, background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--warn-bd)', borderRadius: 8, padding: '6px 10px', fontSize: 11.5, fontWeight: 700 }}>
          Map tiles need internet · GPS still works
        </div>
      ) : null}
      {children ? (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 8, zIndex: 500, pointerEvents: 'none' }}>
          {children}
        </div>
      ) : null}
      <span className="g-map-scale" style={{ zIndex: 500 }}>{label}</span>
    </div>
  );
};

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
  <div className="g-tabs" role="tablist" aria-label="View options">
    {options.map((o) => (
      <button key={o} type="button" role="tab" aria-selected={o === value} className={o === value ? 'on' : ''} onClick={() => onChange(o)}>
        {o}
      </button>
    ))}
  </div>
);

export const Skeleton = ({ lines = 3 }) => (
  <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="skeleton" style={{ height: 14, width: `${100 - i * 12}%` }} />
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
