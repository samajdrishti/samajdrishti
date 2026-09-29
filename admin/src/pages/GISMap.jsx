import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, Chip, Button, Alert, Stack, Divider, Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Videocam as VideocamIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Shield as ShieldIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import { gisAPI, monitoringAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const SCHEME_BADGES = {
  AVYAY: { label: 'AVYAY (Senior Citizens)', color: '#0284c7', bg: '#e0f2fe' },
  NAPDDR: { label: 'NAPDDR (De-Addiction)', color: '#d97706', bg: '#fef3c7' },
  SIPDA: { label: 'SIPDA (PwD Skills)', color: '#059669', bg: '#d1fae5' },
};

const SCHEME_COLORS = { AVYAY: '#0284c7', NAPDDR: '#d97706', SIPDA: '#059669' };
const INDIA_CENTER = { lat: 23.4, lng: 78.9 };

const centerColor = (center) =>
  center.status === 'flagged' ? '#dc2626' : SCHEME_COLORS[center.scheme] || '#64748b';

const statusChipColor = (status) =>
  status === 'flagged' ? 'error' : status === 'completed' ? 'success' : 'primary';

/** Loads the Google Maps JS API once, with the key served by our backend. */
const loadGoogleMaps = (key) =>
  new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve();
    if (!key) return reject(new Error('no-key'));

    const fail = (why) => reject(new Error(why));
    const existing = document.getElementById('sd-google-maps');
    const check = () =>
      window.google && window.google.maps ? resolve() : fail('init-failed');

    if (existing) {
      existing.addEventListener('load', check);
      existing.addEventListener('error', () => fail('load-error'));
      return undefined;
    }

    window.__sdMapsCallback = check;
    const script = document.createElement('script');
    script.id = 'sd-google-maps';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__sdMapsCallback`;
    script.onerror = () => fail('load-error');
    document.head.appendChild(script);
    setTimeout(() => {
      if (!(window.google && window.google.maps)) fail('timeout');
    }, 10000);
    return undefined;
  });

const GISMap = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedScheme, setSelectedScheme] = useState('ALL');
  const [activeId, setActiveId] = useState(null);
  const [engine, setEngine] = useState('pending'); // pending | google | leaflet
  const [engineNote, setEngineNote] = useState(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [tick, setTick] = useState(0);

  const mapRef = useRef(null);
  const gRef = useRef(null); // { map, markers }
  const lRef = useRef(null); // { map, layer, L }
  const navigate = useNavigate();

  const centers = useMemo(() => data?.centers || [], [data]);
  const filteredCenters = useMemo(
    () => centers.filter((c) => selectedScheme === 'ALL' || (c.scheme || '').toUpperCase() === selectedScheme),
    [centers, selectedScheme]
  );
  const activeCenter = useMemo(
    () => filteredCenters.find((c) => c.id === activeId) || filteredCenters[0] || null,
    [filteredCenters, activeId]
  );
  const activeCameras = activeCenter?.cameras || [];
  const onlineCameras = activeCameras.filter((c) => c.online).length;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await gisAPI.centers();
      setData(res.data);
    } catch (err) {
      console.error('GIS load error:', err);
      setError('Could not load the compliance GIS feed. Is the API running on port 5000?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Pick the real-map engine: Google Maps with the backend key, OSM fallback.
  useEffect(() => {
    if (!data) return undefined;
    let cancelled = false;
    loadGoogleMaps(data.map?.api_key)
      .then(() => !cancelled && setEngine('google'))
      .catch((err) => {
        if (cancelled) return;
        setEngine('leaflet');
        setEngineNote(
          err.message === 'no-key'
            ? 'No Google Maps API key configured on the backend — using OpenStreetMap tiles.'
            : 'Google Maps could not initialise with this key on this machine — using OpenStreetMap tiles.'
        );
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  // Google map instance.
  useEffect(() => {
    if (engine !== 'google' || !data || !mapRef.current || gRef.current) return undefined;
    const g = window.google.maps;
    const map = new g.Map(mapRef.current, {
      center: INDIA_CENTER,
      zoom: 5,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
    });
    gRef.current = { map, markers: [] };
    // If Google rejects the key after (lazy) auth, degrade to OSM instead of a grey map.
    window.gm_authFailure = () => {
      setEngine('leaflet');
      setEngineNote('Google Maps rejected this key (auth failure) — switched to OpenStreetMap tiles.');
    };
    return () => {
      (gRef.current?.markers || []).forEach((m) => m.setMap(null));
      gRef.current = null;
    };
  }, [engine, data]);

  // Leaflet fallback instance (loaded lazily so it never weighs on the bundle).
  useEffect(() => {
    if (engine !== 'leaflet' || !data || !mapRef.current || lRef.current) return undefined;
    let disposed = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (disposed || !mapRef.current) return;
      mapRef.current.innerHTML = '';
      const map = L.map(mapRef.current).setView([INDIA_CENTER.lat, INDIA_CENTER.lng], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      lRef.current = { map, layer: L.layerGroup().addTo(map), L };
      setLeafletReady(true);
    })();
    return () => {
      disposed = true;
      if (lRef.current?.map) lRef.current.map.remove();
      lRef.current = null;
      setLeafletReady(false);
    };
  }, [engine, data]);

  // Keep the markers in sync with the filter and the selected center.
  useEffect(() => {
    if (!activeCenter) return;
    if (engine === 'google' && gRef.current) {
      const g = window.google.maps;
      const { map, markers } = gRef.current;
      markers.forEach((m) => m.setMap(null));
      gRef.current.markers = filteredCenters.map((center) => {
        const selected = center.id === activeCenter.id;
        const marker = new g.Marker({
          position: {
            lat: center.geo_coords?.lat || INDIA_CENTER.lat,
            lng: center.geo_coords?.lng || INDIA_CENTER.lng,
          },
          map,
          title: center.name,
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: selected ? 11 : 8,
            fillColor: centerColor(center),
            fillOpacity: selected ? 1 : 0.85,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
        marker.addListener('click', () => setActiveId(center.id));
        return marker;
      });
      if (activeCenter.geo_coords?.lat) {
        map.panTo({ lat: activeCenter.geo_coords.lat, lng: activeCenter.geo_coords.lng });
        if ((map.getZoom() || 5) < 7) map.setZoom(9);
      }
    }
    if (engine === 'leaflet' && lRef.current && leafletReady) {
      const { map, layer, L } = lRef.current;
      layer.clearLayers();
      filteredCenters.forEach((center) => {
        const selected = center.id === activeCenter.id;
        L.circleMarker(
          [center.geo_coords?.lat || INDIA_CENTER.lat, center.geo_coords?.lng || INDIA_CENTER.lng],
          {
            radius: selected ? 10 : 7,
            color: '#ffffff',
            weight: 2,
            fillColor: centerColor(center),
            fillOpacity: selected ? 1 : 0.85,
          }
        )
          .bindTooltip(center.name, { direction: 'top' })
          .on('click', () => setActiveId(center.id))
          .addTo(layer);
      });
      if (activeCenter.geo_coords?.lat) {
        map.setView(
          [activeCenter.geo_coords.lat, activeCenter.geo_coords.lng],
          Math.max(map.getZoom() || 5, 8)
        );
      }
    }
  }, [engine, filteredCenters, activeCenter, leafletReady]);

  // Live snapshots: refresh the ground-CCTV wall every 4 s.
  useEffect(() => {
    if (!onlineCameras) return undefined;
    const interval = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(interval);
  }, [activeCenter?.id, onlineCameras]);

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 420 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            🗺️ Real-Time Compliance GIS Map
          </Typography>
          <Typography variant="body2" color="text.secondary">
            DoSJE National Monitoring · real map of monitored centers · click a center for its in-charge and ground-level CCTV
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            icon={<PublicIcon />}
            label={
              engine === 'google'
                ? 'Google Maps · live key'
                : engine === 'leaflet'
                  ? 'OpenStreetMap fallback'
                  : 'Loading map…'
            }
            color={engine === 'google' ? 'success' : 'default'}
            variant="outlined"
          />
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={load}>
            Refresh Feeds
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}
        >
          {error}
        </Alert>
      )}
      {engineNote && <Alert severity="info" sx={{ mb: 2 }}>{engineNote}</Alert>}

      <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" sx={{ mr: 1 }}>Scheme Filter:</Typography>
          {['ALL', 'AVYAY', 'NAPDDR', 'SIPDA'].map((s) => (
            <Chip
              key={s}
              label={s === 'ALL' ? `All Facilities (${centers.length})` : SCHEME_BADGES[s]?.label || s}
              onClick={() => {
                setSelectedScheme(s);
                setActiveId(null);
              }}
              color={selectedScheme === s ? 'primary' : 'default'}
              variant={selectedScheme === s ? 'filled' : 'outlined'}
              sx={{ fontWeight: 600, cursor: 'pointer' }}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, fontSize: 13, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#16a34a' }} />
            <span>Compliant</span>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#dc2626' }} />
            <span>Flagged / audit spotlight</span>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <VideocamIcon sx={{ fontSize: 15, color: '#0e7490' }} />
            <span>{centers.reduce((sum, c) => sum + c.camera_count, 0)} ground cameras registered</span>
          </Box>
        </Box>
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 0.75, position: 'relative', overflow: 'hidden' }}>
            <Box ref={mapRef} sx={{ height: 560, width: '100%', borderRadius: 1, bgcolor: '#e8eef6' }} />
            {engine === 'pending' && (
              <Box
                sx={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', alignItems: 'center', gap: 1.5, bgcolor: 'rgba(255,255,255,0.65)',
                }}
              >
                <CircularProgress size={28} />
                <Typography variant="caption" color="text.secondary">Loading the live map…</Typography>
              </Box>
            )}
          </Paper>
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', mt: 1.5, px: 0.5, fontSize: 12.5, color: '#475569' }}>
            {Object.entries(SCHEME_COLORS).map(([scheme, color]) => (
              <Box key={scheme} sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: color }} />
                <span>{SCHEME_BADGES[scheme]?.label || scheme}</span>
              </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
              <LocationIcon sx={{ fontSize: 14 }} />
              <span>Click a center pin (or a facility in the list) to open its in-charge and ground-level CCTV.</span>
            </Box>
          </Box>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Paper sx={{ p: 1.25, overflow: 'auto', maxHeight: 210 }}>
              <Typography variant="subtitle2" sx={{ px: 0.5, mb: 1, color: '#334155' }}>
                Monitored Facilities ({filteredCenters.length})
              </Typography>
              <Stack spacing={0.5}>
                {filteredCenters.map((c) => {
                  const selected = activeCenter?.id === c.id;
                  return (
                    <Box
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      sx={{
                        cursor: 'pointer',
                        px: 1,
                        py: 0.75,
                        borderRadius: 1.25,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        bgcolor: selected ? '#eff6ff' : 'transparent',
                        border: '1px solid',
                        borderColor: selected ? '#bfdbfe' : 'transparent',
                        '&:hover': { bgcolor: '#f8fafc' },
                      }}
                    >
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: centerColor(c), flexShrink: 0 }} />
                      <Typography noWrap sx={{ fontSize: 12.5, fontWeight: selected ? 700 : 500, flexGrow: 1 }} title={c.name}>
                        {c.name}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${c.cameras_online}/${c.camera_count}`}
                        icon={<VideocamIcon sx={{ fontSize: 13 }} />}
                        sx={{ height: 20, fontSize: 10.5, flexShrink: 0 }}
                        variant="outlined"
                        color={c.cameras_online ? 'success' : 'default'}
                      />
                    </Box>
                  );
                })}
              </Stack>
            </Paper>

            {activeCenter ? (
              <Paper sx={{ p: 2.25, overflow: 'auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    label={SCHEME_BADGES[activeCenter.scheme]?.label || activeCenter.scheme}
                    sx={{
                      bgcolor: SCHEME_BADGES[activeCenter.scheme]?.bg || '#f1f5f9',
                      color: SCHEME_BADGES[activeCenter.scheme]?.color || '#475569',
                      fontWeight: 700,
                    }}
                  />
                  <Chip size="small" label={activeCenter.status} color={statusChipColor(activeCenter.status)} />
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                  {activeCenter.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  📍 {activeCenter.location}
                </Typography>

                <Divider sx={{ my: 1.5 }} />

                {activeCenter.status === 'flagged' && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    <strong>DoSJE Audit Spotlight:</strong> this center is flagged — CCTV tamper or headcount
                    anomalies were detected. Physically verify before releasing further grants.
                  </Alert>
                )}

                <Box sx={{ bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 2, p: 1.75, mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <PersonIcon sx={{ fontSize: 16, color: '#0369a1' }} />
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 800, letterSpacing: 0.6, color: '#0369a1', textTransform: 'uppercase' }}
                    >
                      Center Head / In-charge
                    </Typography>
                  </Box>
                  {activeCenter.head ? (
                    <>
                      <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{activeCenter.head.name}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {activeCenter.head.designation}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {activeCenter.head.phone && (
                          <Chip
                            component="a"
                            href={`tel:${activeCenter.head.phone}`}
                            clickable
                            size="small"
                            icon={<PhoneIcon sx={{ fontSize: 14 }} />}
                            label={activeCenter.head.phone}
                            variant="outlined"
                          />
                        )}
                        {activeCenter.head.email && (
                          <Chip
                            component="a"
                            href={`mailto:${activeCenter.head.email}`}
                            clickable
                            size="small"
                            icon={<EmailIcon sx={{ fontSize: 14 }} />}
                            label={activeCenter.head.email}
                            variant="outlined"
                          />
                        )}
                        {activeCenter.head.since && (
                          <Chip size="small" label={`In-charge since ${activeCenter.head.since}`} variant="outlined" />
                        )}
                      </Stack>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Head-of-center details are not on file for this facility yet.
                    </Typography>
                  )}
                </Box>

                <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 1.5, mb: 2 }}>
                  <Grid container spacing={1} sx={{ fontSize: 12 }}>
                    <Grid item xs={6}>
                      <span style={{ color: '#64748b' }}>Sanctioned Budget:</span>
                      <div style={{ fontWeight: 700 }}>₹{(activeCenter.budget || 0).toLocaleString('en-IN')}</div>
                    </Grid>
                    <Grid item xs={6}>
                      <span style={{ color: '#64748b' }}>Sanction Code:</span>
                      <div style={{ fontWeight: 700, fontSize: 11 }}>{activeCenter.sanction_code || '—'}</div>
                    </Grid>
                    <Grid item xs={6} sx={{ mt: 1 }}>
                      <span style={{ color: '#64748b' }}>Sanctioned Capacity:</span>
                      <div style={{ fontWeight: 700 }}>{activeCenter.sanctioned_capacity ?? '—'}</div>
                    </Grid>
                    <Grid item xs={6} sx={{ mt: 1 }}>
                      <span style={{ color: '#64748b' }}>Verified Headcount:</span>
                      <div style={{ fontWeight: 700 }}>{activeCenter.verified_headcount ?? '—'}</div>
                    </Grid>
                    <Grid item xs={6} sx={{ mt: 1 }}>
                      <span style={{ color: '#64748b' }}>AEBAS Punches:</span>
                      <div style={{ fontWeight: 700 }}>{activeCenter.aebas_punch_count ?? '—'}</div>
                    </Grid>
                    <Grid item xs={6} sx={{ mt: 1 }}>
                      <span style={{ color: '#64748b' }}>Discrepancy Δ:</span>
                      <div
                        style={{
                          fontWeight: 700,
                          color: (activeCenter.discrepancy_delta || 0) > 5 ? '#dc2626' : '#059669',
                        }}
                      >
                        {activeCenter.discrepancy_delta ?? '—'}
                      </div>
                    </Grid>
                    <Grid item xs={6} sx={{ mt: 1 }}>
                      <span style={{ color: '#64748b' }}>NavIC Coordinates:</span>
                      <div style={{ fontWeight: 700 }}>
                        {activeCenter.geo_coords?.lat != null
                          ? `${activeCenter.geo_coords.lat.toFixed(4)}°N, ${activeCenter.geo_coords.lng.toFixed(4)}°E`
                          : '—'}
                      </div>
                    </Grid>
                    <Grid item xs={6} sx={{ mt: 1 }}>
                      <span style={{ color: '#64748b' }}>AI Anomaly Status:</span>
                      <div
                        style={{
                          fontWeight: 700,
                          color: activeCenter.status === 'flagged' ? '#ef4444' : '#059669',
                        }}
                      >
                        {activeCenter.status === 'flagged' ? 'HIGH RISK DETECTED' : 'NOMINAL'}
                      </div>
                    </Grid>
                  </Grid>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <VideocamIcon sx={{ fontSize: 17, color: '#0e7490' }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0e7490', letterSpacing: 0.3 }}>
                      GROUND-LEVEL CCTV · LIVE
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    color={onlineCameras ? 'success' : 'default'}
                    label={`${onlineCameras}/${activeCameras.length} online`}
                  />
                </Box>

                {activeCameras.length ? (
                  <Grid container spacing={1.25} sx={{ mb: 2 }}>
                    {activeCameras.map((cam) => (
                      <Grid item xs={12} sm={6} key={cam.id}>
                        <Tooltip title={cam.anomaly_note || cam.name} arrow>
                          <Paper
                            variant="outlined"
                            sx={{ overflow: 'hidden', borderRadius: 1.5, borderColor: cam.online ? '#bae6fd' : '#e2e8f0' }}
                          >
                            <Box sx={{ position: 'relative', bgcolor: '#0f172a' }}>
                              {cam.online ? (
                                <Box
                                  component="img"
                                  src={`${monitoringAPI.snapshotUrl(cam.id)}&frame=${tick}`}
                                  alt={cam.name}
                                  sx={{ display: 'block', width: '100%', height: 108, objectFit: 'cover' }}
                                />
                              ) : (
                                <Box
                                  sx={{
                                    height: 108, display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: 0.5,
                                  }}
                                >
                                  <WarningIcon sx={{ fontSize: 22 }} />
                                  <Typography variant="caption">Feed offline</Typography>
                                </Box>
                              )}
                              <Chip
                                label={cam.online ? '● LIVE' : 'OFFLINE'}
                                size="small"
                                color={cam.online ? 'success' : 'default'}
                                sx={{ position: 'absolute', top: 6, left: 6, height: 19, fontSize: 10, fontWeight: 800 }}
                              />
                              {cam.tamper_flag && cam.tamper_flag !== 'normal' && (
                                <Chip
                                  label={cam.tamper_flag.replace(/_/g, ' ')}
                                  size="small"
                                  color="error"
                                  sx={{ position: 'absolute', top: 6, right: 6, height: 19, fontSize: 10, fontWeight: 700 }}
                                />
                              )}
                            </Box>
                            <Box sx={{ px: 1, py: 0.75 }}>
                              <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 700 }} title={cam.name}>
                                {cam.name}
                              </Typography>
                              <Typography noWrap variant="caption" color="text.secondary" title={cam.location}>
                                {cam.location}
                              </Typography>
                              {cam.detected_headcount != null && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: 'block',
                                    color: cam.detected_headcount === cam.aebas_punch_count ? '#059669' : '#dc2626',
                                  }}
                                >
                                  AI headcount {cam.detected_headcount} · AEBAS {cam.aebas_punch_count}
                                </Typography>
                              )}
                            </Box>
                          </Paper>
                        </Tooltip>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No ground-level cameras registered for this center yet.
                  </Alert>
                )}

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<VideocamIcon />}
                    onClick={() => navigate('/live')}
                  >
                    Live CCTV Wall
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => navigate('/inspections')}>
                    Inspection Records
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ShieldIcon />}
                    onClick={() => navigate('/atr')}
                  >
                    Digital ATR
                  </Button>
                </Stack>
              </Paper>
            ) : (
              <Paper sx={{ p: 3, textAlign: 'center', color: '#64748b' }}>
                Select a facility on the map to inspect its center head and ground-level CCTV cameras.
              </Paper>
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default GISMap;








