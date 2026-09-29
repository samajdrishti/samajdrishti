import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/GISMap.jsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=1b6e2804"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$();
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=1b6e2804"; const React = __vite__cjsImport3_react.__esModule ? __vite__cjsImport3_react.default : __vite__cjsImport3_react; const useState = __vite__cjsImport3_react["useState"]; const useEffect = __vite__cjsImport3_react["useEffect"]; const useRef = __vite__cjsImport3_react["useRef"]; const useMemo = __vite__cjsImport3_react["useMemo"];
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  Alert,
  Stack,
  Divider,
  Tooltip,
  CircularProgress,
  Snackbar
} from "/node_modules/.vite/deps/@mui_material.js?v=1b6e2804";
import {
  LocationOn as LocationIcon,
  Videocam as VideocamIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Shield as ShieldIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Public as PublicIcon
} from "/node_modules/.vite/deps/@mui_icons-material.js?v=1b6e2804";
import { gisAPI, monitoringAPI, vcAPI } from "/src/services/api.js?t=1790698250045";
import { useNavigate } from "/node_modules/.vite/deps/react-router-dom.js?v=1b6e2804";
const SCHEME_BADGES = {
  AVYAY: { label: "AVYAY (Senior Citizens)", color: "#0284c7", bg: "#e0f2fe" },
  NAPDDR: { label: "NAPDDR (De-Addiction)", color: "#d97706", bg: "#fef3c7" },
  SIPDA: { label: "SIPDA (PwD Skills)", color: "#059669", bg: "#d1fae5" }
};
const SCHEME_COLORS = { AVYAY: "#0284c7", NAPDDR: "#d97706", SIPDA: "#059669" };
const INDIA_CENTER = { lat: 23.4, lng: 78.9 };
const centerColor = (center) => center.status === "flagged" ? "#dc2626" : SCHEME_COLORS[center.scheme] || "#64748b";
const statusChipColor = (status) => status === "flagged" ? "error" : status === "completed" ? "success" : "primary";
const PIN_CARD_CSS = `
.sd-pin-card { min-width: 236px; max-width: 268px; font-family: Roboto, 'Segoe UI', sans-serif; color: #0f172a; background: #fff; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 6px 24px rgba(15, 23, 42, 0.18); padding: 10px 12px; }
.sd-pin-card .sd-scheme { display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: 0.4px; padding: 2px 8px; border-radius: 999px; }
.sd-pin-card .sd-name { font-size: 13px; font-weight: 700; line-height: 1.3; margin: 6px 0 2px; }
.sd-pin-card .sd-loc { font-size: 11px; color: #64748b; }
.sd-pin-card .sd-headbox { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 8px 10px; margin: 8px 0; }
.sd-pin-card .sd-headlabel { font-size: 9.5px; font-weight: 800; color: #0369a1; letter-spacing: 0.6px; text-transform: uppercase; }
.sd-pin-card .sd-headname { font-size: 12.5px; font-weight: 700; margin-top: 2px; }
.sd-pin-card .sd-headdesig { font-size: 11px; color: #475569; }
.sd-pin-card .sd-actions { display: flex; gap: 6px; }
.sd-pin-card .sd-btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-size: 11.5px; font-weight: 700; padding: 6px 8px; border-radius: 8px; cursor: pointer; text-decoration: none; border: 1px solid transparent; font-family: inherit; }
.sd-pin-card .sd-call { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
.sd-pin-card .sd-call:hover { background: #d1fae5; }
.sd-pin-card .sd-vc { background: #eef2ff; border-color: #c7d2fe; color: #4338ca; }
.sd-pin-card .sd-vc:hover { background: #e0e7ff; }
.sd-pin-card .sd-vc[disabled] { opacity: 0.65; cursor: wait; }
.sd-pin-card .sd-hint { font-size: 10px; color: #94a3b8; margin-top: 6px; }
.leaflet-tooltip.sd-pin-tip { background: transparent; border: none; box-shadow: none; padding: 0; white-space: normal; }
.leaflet-tooltip.sd-pin-tip::before { display: none; }
`;
const buildPinCard = (center, onVideoCall) => {
  const scheme = SCHEME_BADGES[center.scheme] || {
    label: center.scheme || "Department",
    color: "#475569",
    bg: "#f1f5f9"
  };
  const head = center.head || {};
  const el = document.createElement("div");
  el.className = "sd-pin-card";
  el.innerHTML = `
    <span class="sd-scheme" style="background:${scheme.bg};color:${scheme.color};">${scheme.label}</span>
    <div class="sd-name">${center.name}</div>
    <div class="sd-loc">📍 ${center.location || ""}</div>
    <div class="sd-headbox">
      <div class="sd-headlabel">Current Head</div>
      <div class="sd-headname">${head.name || "Head not on file"}</div>
      <div class="sd-headdesig">${head.designation || ""}</div>
    </div>
    <div class="sd-actions">
      ${head.phone ? `<a class="sd-btn sd-call" href="tel:${head.phone}">📞 Call</a>` : ""}
      <button type="button" class="sd-btn sd-vc">🎥 Video call</button>
    </div>
    <div class="sd-hint">Click the pin for the full drill-down (CCTV, compliance)</div>`;
  el.querySelector(".sd-vc").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onVideoCall(center);
  });
  return el;
};
const loadGoogleMaps = (key) => new Promise((resolve, reject) => {
  if (window.google && window.google.maps)
    return resolve();
  if (!key)
    return reject(new Error("no-key"));
  const fail = (why) => reject(new Error(why));
  const existing = document.getElementById("sd-google-maps");
  const check = () => window.google && window.google.maps ? resolve() : fail("init-failed");
  if (existing) {
    existing.addEventListener("load", check);
    existing.addEventListener("error", () => fail("load-error"));
    return void 0;
  }
  window.__sdMapsCallback = check;
  const script = document.createElement("script");
  script.id = "sd-google-maps";
  script.async = true;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__sdMapsCallback`;
  script.onerror = () => fail("load-error");
  document.head.appendChild(script);
  setTimeout(() => {
    if (!(window.google && window.google.maps))
      fail("timeout");
  }, 1e4);
  return void 0;
});
const GISMap = () => {
  _s();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedScheme, setSelectedScheme] = useState("ALL");
  const [activeId, setActiveId] = useState(null);
  const [engine, setEngine] = useState("pending");
  const [engineNote, setEngineNote] = useState(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [tick, setTick] = useState(0);
  const mapRef = useRef(null);
  const gRef = useRef(null);
  const lRef = useRef(null);
  const pinCardsRef = useRef(/* @__PURE__ */ new Map());
  const pinTimerRef = useRef(null);
  const vcHandlerRef = useRef(null);
  const [vcNotice, setVcNotice] = useState(null);
  const [vcBusy, setVcBusy] = useState(null);
  const navigate = useNavigate();
  const centers = useMemo(() => data?.centers || [], [data]);
  const filteredCenters = useMemo(
    () => centers.filter((c) => selectedScheme === "ALL" || (c.scheme || "").toUpperCase() === selectedScheme),
    [centers, selectedScheme]
  );
  const activeCenter = useMemo(
    () => filteredCenters.find((c) => c.id === activeId) || filteredCenters[0] || null,
    [filteredCenters, activeId]
  );
  const activeCameras = activeCenter?.cameras || [];
  const onlineCameras = activeCameras.filter((c) => c.online).length;
  const hidePinCard = () => {
    if (gRef.current?.info)
      gRef.current.info.close();
  };
  const schedulePinClose = () => {
    clearTimeout(pinTimerRef.current);
    pinTimerRef.current = setTimeout(hidePinCard, 320);
  };
  const getPinCard = (center) => {
    if (!pinCardsRef.current.has(center.id)) {
      const card = buildPinCard(center, (c) => vcHandlerRef.current && vcHandlerRef.current(c));
      card.addEventListener("mouseenter", () => clearTimeout(pinTimerRef.current));
      card.addEventListener("mouseleave", () => schedulePinClose());
      pinCardsRef.current.set(center.id, card);
    }
    return pinCardsRef.current.get(center.id);
  };
  const openPinCard = (center, marker) => {
    clearTimeout(pinTimerRef.current);
    if (!gRef.current?.info)
      return;
    gRef.current.info.setContent(getPinCard(center));
    gRef.current.info.open({ map: gRef.current.map, anchor: marker });
  };
  const startVideoCall = async (center) => {
    if (!center)
      return;
    setVcBusy(center.id);
    const cardButton = pinCardsRef.current.get(center.id)?.querySelector(".sd-vc");
    if (cardButton) {
      cardButton.disabled = true;
      cardButton.textContent = "🎥 Connecting…";
    }
    const win = window.open("", "_blank");
    try {
      const { data: body } = await vcAPI.create({ project_id: center.id, mode: "direct" });
      const session = body?.session || {};
      if (win && session.join_url) {
        win.location.href = session.join_url;
        setVcNotice(
          `🎥 VC room ${session.room_id} opened with ${center.head?.name || center.name}` + (session.official_name ? ` · official on the line: ${session.official_name}` : "") + "."
        );
      } else {
        if (win)
          win.close();
        setVcNotice(`A room was created but the popup was blocked - open it here: ${session.join_url || ""}`);
      }
    } catch (err) {
      if (win)
        win.close();
      setVcNotice(err.response?.data?.message || "Could not open a video-call session.");
    } finally {
      if (cardButton) {
        cardButton.disabled = false;
        cardButton.textContent = "🎥 Video call";
      }
      setVcBusy(null);
    }
  };
  vcHandlerRef.current = startVideoCall;
  useEffect(() => {
    pinCardsRef.current.clear();
  }, [data]);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await gisAPI.centers();
      setData(res.data);
    } catch (err) {
      console.error("GIS load error:", err);
      setError("Could not load the compliance GIS feed. Is the API running on port 5000?");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!data)
      return void 0;
    let cancelled = false;
    loadGoogleMaps(data.map?.api_key).then(() => !cancelled && setEngine("google")).catch((err) => {
      if (cancelled)
        return;
      setEngine("leaflet");
      setEngineNote(
        err.message === "no-key" ? "No Google Maps API key configured on the backend — using OpenStreetMap tiles." : "Google Maps could not initialise with this key on this machine — using OpenStreetMap tiles."
      );
    });
    return () => {
      cancelled = true;
    };
  }, [data]);
  useEffect(() => {
    if (engine !== "google" || !data || !mapRef.current || gRef.current)
      return void 0;
    const g = window.google.maps;
    const map = new g.Map(mapRef.current, {
      center: INDIA_CENTER,
      zoom: 5,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false
    });
    gRef.current = { map, markers: [], info: new g.InfoWindow({ disableAutoPan: true }) };
    map.addListener("click", () => {
      if (gRef.current?.info)
        gRef.current.info.close();
    });
    window.gm_authFailure = () => {
      setEngine("leaflet");
      setEngineNote("Google Maps rejected this key (auth failure) — switched to OpenStreetMap tiles.");
    };
    return () => {
      (gRef.current?.markers || []).forEach((m) => m.setMap(null));
      gRef.current = null;
    };
  }, [engine, data]);
  useEffect(() => {
    if (engine !== "leaflet" || !data || !mapRef.current || lRef.current)
      return void 0;
    let disposed = false;
    (async () => {
      const L = (await import('/node_modules/.vite/deps/leaflet.js?v=1b6e2804').then(m => m.default && m.default.__esModule ? m.default : ({ ...m.default, default: m.default }))).default;
      await import("/node_modules/leaflet/dist/leaflet.css");
      if (disposed || !mapRef.current)
        return;
      mapRef.current.innerHTML = "";
      const map = L.map(mapRef.current).setView([INDIA_CENTER.lat, INDIA_CENTER.lng], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
      lRef.current = { map, layer: L.layerGroup().addTo(map), L };
      setLeafletReady(true);
    })();
    return () => {
      disposed = true;
      if (lRef.current?.map)
        lRef.current.map.remove();
      lRef.current = null;
      setLeafletReady(false);
    };
  }, [engine, data]);
  useEffect(() => {
    if (!activeCenter)
      return;
    if (engine === "google" && gRef.current) {
      const g = window.google.maps;
      const { map, markers } = gRef.current;
      markers.forEach((m) => m.setMap(null));
      gRef.current.markers = filteredCenters.map((center) => {
        const selected = center.id === activeCenter.id;
        const marker = new g.Marker({
          position: {
            lat: center.geo_coords?.lat || INDIA_CENTER.lat,
            lng: center.geo_coords?.lng || INDIA_CENTER.lng
          },
          map,
          title: center.name,
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: selected ? 11 : 8,
            fillColor: centerColor(center),
            fillOpacity: selected ? 1 : 0.85,
            strokeColor: "#ffffff",
            strokeWeight: 2
          }
        });
        marker.addListener("click", () => setActiveId(center.id));
        marker.addListener("mouseover", () => openPinCard(center, marker));
        marker.addListener("mouseout", () => schedulePinClose());
        return marker;
      });
      if (activeCenter.geo_coords?.lat) {
        map.panTo({ lat: activeCenter.geo_coords.lat, lng: activeCenter.geo_coords.lng });
        if ((map.getZoom() || 5) < 7)
          map.setZoom(9);
      }
    }
    if (engine === "leaflet" && lRef.current && leafletReady) {
      const { map, layer, L } = lRef.current;
      layer.clearLayers();
      filteredCenters.forEach((center) => {
        const selected = center.id === activeCenter.id;
        L.circleMarker(
          [center.geo_coords?.lat || INDIA_CENTER.lat, center.geo_coords?.lng || INDIA_CENTER.lng],
          {
            radius: selected ? 10 : 7,
            color: "#ffffff",
            weight: 2,
            fillColor: centerColor(center),
            fillOpacity: selected ? 1 : 0.85
          }
        ).bindTooltip(getPinCard(center), {
          direction: "top",
          offset: [0, -10],
          opacity: 1,
          interactive: true,
          className: "sd-pin-tip"
        }).on("click", () => setActiveId(center.id)).addTo(layer);
      });
      if (activeCenter.geo_coords?.lat) {
        map.setView(
          [activeCenter.geo_coords.lat, activeCenter.geo_coords.lng],
          Math.max(map.getZoom() || 5, 8)
        );
      }
    }
  }, [engine, filteredCenters, activeCenter, leafletReady]);
  useEffect(() => {
    if (!onlineCameras)
      return void 0;
    const interval = setInterval(() => setTick((t) => t + 1), 4e3);
    return () => clearInterval(interval);
  }, [activeCenter?.id, onlineCameras]);
  if (loading && !data) {
    return /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: 420 }, children: /* @__PURE__ */ jsxDEV(CircularProgress, {}, void 0, false, {
      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
      lineNumber: 412,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
      lineNumber: 411,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV(Box, { children: [
    /* @__PURE__ */ jsxDEV("style", { children: PIN_CARD_CSS }, void 0, false, {
      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
      lineNumber: 419,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 2 }, children: [
      /* @__PURE__ */ jsxDEV(Box, { children: [
        /* @__PURE__ */ jsxDEV(Typography, { variant: "h4", sx: { fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }, children: "🗺️ Real-Time Compliance GIS Map" }, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 422,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(Typography, { variant: "body2", color: "text.secondary", children: "DoSJE National Monitoring · real map of monitored centers · click a center for its in-charge and ground-level CCTV" }, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 425,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 421,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV(Stack, { direction: "row", spacing: 1, alignItems: "center", children: [
        /* @__PURE__ */ jsxDEV(
          Chip,
          {
            size: "small",
            icon: /* @__PURE__ */ jsxDEV(PublicIcon, {}, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 432,
              columnNumber: 19
            }, this),
            label: engine === "google" ? "Google Maps · live key" : engine === "leaflet" ? "OpenStreetMap fallback" : "Loading map…",
            color: engine === "google" ? "success" : "default",
            variant: "outlined"
          },
          void 0,
          false,
          {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 430,
            columnNumber: 11
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(Button, { variant: "outlined", size: "small", startIcon: /* @__PURE__ */ jsxDEV(RefreshIcon, {}, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 443,
          columnNumber: 62
        }, this), onClick: load, children: "Refresh Feeds" }, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 443,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 429,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
      lineNumber: 420,
      columnNumber: 7
    }, this),
    error && /* @__PURE__ */ jsxDEV(
      Alert,
      {
        severity: "error",
        sx: { mb: 2 },
        action: /* @__PURE__ */ jsxDEV(Button, { color: "inherit", size: "small", onClick: load, children: "Retry" }, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 453,
          columnNumber: 17
        }, this),
        children: error
      },
      void 0,
      false,
      {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 450,
        columnNumber: 7
      },
      this
    ),
    engineNote && /* @__PURE__ */ jsxDEV(Alert, { severity: "info", sx: { mb: 2 }, children: engineNote }, void 0, false, {
      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
      lineNumber: 458,
      columnNumber: 22
    }, this),
    /* @__PURE__ */ jsxDEV(Paper, { sx: { p: 2, mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }, children: [
      /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ jsxDEV(Typography, { variant: "subtitle2", sx: { mr: 1 }, children: "Scheme Filter:" }, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 462,
          columnNumber: 11
        }, this),
        ["ALL", "AVYAY", "NAPDDR", "SIPDA"].map(
          (s) => /* @__PURE__ */ jsxDEV(
            Chip,
            {
              label: s === "ALL" ? `All Facilities (${centers.length})` : SCHEME_BADGES[s]?.label || s,
              onClick: () => {
                setSelectedScheme(s);
                setActiveId(null);
              },
              color: selectedScheme === s ? "primary" : "default",
              variant: selectedScheme === s ? "filled" : "outlined",
              sx: { fontWeight: 600, cursor: "pointer" }
            },
            s,
            false,
            {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 464,
              columnNumber: 11
            },
            this
          )
        )
      ] }, void 0, true, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 461,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", gap: 2, fontSize: 13, alignItems: "center", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.5 }, children: [
          /* @__PURE__ */ jsxDEV(Box, { sx: { width: 12, height: 12, borderRadius: "50%", bgcolor: "#16a34a" } }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 479,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { children: "Compliant" }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 480,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 478,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.5 }, children: [
          /* @__PURE__ */ jsxDEV(Box, { sx: { width: 12, height: 12, borderRadius: "50%", bgcolor: "#dc2626" } }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 483,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { children: "Flagged / audit spotlight" }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 484,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 482,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.5 }, children: [
          /* @__PURE__ */ jsxDEV(VideocamIcon, { sx: { fontSize: 15, color: "#0e7490" } }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 487,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { children: [
            centers.reduce((sum, c) => sum + c.camera_count, 0),
            " ground cameras registered"
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 488,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 486,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 477,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
      lineNumber: 460,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Grid, { container: true, spacing: 3, children: [
      /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 12, lg: 8, children: [
        /* @__PURE__ */ jsxDEV(Paper, { sx: { p: 0.75, position: "relative", overflow: "hidden" }, children: [
          /* @__PURE__ */ jsxDEV(Box, { ref: mapRef, sx: { height: 560, width: "100%", borderRadius: 1, bgcolor: "#e8eef6" } }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 496,
            columnNumber: 13
          }, this),
          engine === "pending" && /* @__PURE__ */ jsxDEV(
            Box,
            {
              sx: {
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: 1.5,
                bgcolor: "rgba(255,255,255,0.65)"
              },
              children: [
                /* @__PURE__ */ jsxDEV(CircularProgress, { size: 28 }, void 0, false, {
                  fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                  lineNumber: 504,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV(Typography, { variant: "caption", color: "text.secondary", children: "Loading the live map…" }, void 0, false, {
                  fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                  lineNumber: 505,
                  columnNumber: 17
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 498,
              columnNumber: 13
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 495,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", gap: 2.5, flexWrap: "wrap", mt: 1.5, px: 0.5, fontSize: 12.5, color: "#475569" }, children: [
          Object.entries(SCHEME_COLORS).map(
            ([scheme, color]) => /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.7 }, children: [
              /* @__PURE__ */ jsxDEV(Box, { sx: { width: 11, height: 11, borderRadius: "50%", bgcolor: color } }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 512,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("span", { children: SCHEME_BADGES[scheme]?.label || scheme }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 513,
                columnNumber: 17
              }, this)
            ] }, scheme, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 511,
              columnNumber: 13
            }, this)
          ),
          /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.7 }, children: [
            /* @__PURE__ */ jsxDEV(LocationIcon, { sx: { fontSize: 14 } }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 517,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("span", { children: "Hover a pin for the department head + call / video-call actions · click a pin for the full drill-down." }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 518,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 516,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 509,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 494,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 12, lg: 4, children: /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", flexDirection: "column", gap: 2 }, children: [
        /* @__PURE__ */ jsxDEV(Paper, { sx: { p: 1.25, overflow: "auto", maxHeight: 210 }, children: [
          /* @__PURE__ */ jsxDEV(Typography, { variant: "subtitle2", sx: { px: 0.5, mb: 1, color: "#334155" }, children: [
            "Monitored Facilities (",
            filteredCenters.length,
            ")"
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 525,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV(Stack, { spacing: 0.5, children: filteredCenters.map((c) => {
            const selected = activeCenter?.id === c.id;
            return /* @__PURE__ */ jsxDEV(
              Box,
              {
                onClick: () => setActiveId(c.id),
                sx: {
                  cursor: "pointer",
                  px: 1,
                  py: 0.75,
                  borderRadius: 1.25,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  bgcolor: selected ? "#eff6ff" : "transparent",
                  border: "1px solid",
                  borderColor: selected ? "#bfdbfe" : "transparent",
                  "&:hover": { bgcolor: "#f8fafc" }
                },
                children: [
                  /* @__PURE__ */ jsxDEV(Box, { sx: { width: 10, height: 10, borderRadius: "50%", bgcolor: centerColor(c), flexShrink: 0 } }, void 0, false, {
                    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                    lineNumber: 549,
                    columnNumber: 23
                  }, this),
                  /* @__PURE__ */ jsxDEV(Typography, { noWrap: true, sx: { fontSize: 12.5, fontWeight: selected ? 700 : 500, flexGrow: 1 }, title: c.name, children: c.name }, void 0, false, {
                    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                    lineNumber: 550,
                    columnNumber: 23
                  }, this),
                  /* @__PURE__ */ jsxDEV(
                    Chip,
                    {
                      size: "small",
                      label: `${c.cameras_online}/${c.camera_count}`,
                      icon: /* @__PURE__ */ jsxDEV(VideocamIcon, { sx: { fontSize: 13 } }, void 0, false, {
                        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                        lineNumber: 556,
                        columnNumber: 31
                      }, this),
                      sx: { height: 20, fontSize: 10.5, flexShrink: 0 },
                      variant: "outlined",
                      color: c.cameras_online ? "success" : "default"
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                      lineNumber: 553,
                      columnNumber: 23
                    },
                    this
                  )
                ]
              },
              c.id,
              true,
              {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 532,
                columnNumber: 21
              },
              this
            );
          }) }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 528,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 524,
          columnNumber: 13
        }, this),
        activeCenter ? /* @__PURE__ */ jsxDEV(Paper, { sx: { p: 2.25, overflow: "auto" }, children: [
          /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsxDEV(
              Chip,
              {
                size: "small",
                label: SCHEME_BADGES[activeCenter.scheme]?.label || activeCenter.scheme,
                sx: {
                  bgcolor: SCHEME_BADGES[activeCenter.scheme]?.bg || "#f1f5f9",
                  color: SCHEME_BADGES[activeCenter.scheme]?.color || "#475569",
                  fontWeight: 700
                }
              },
              void 0,
              false,
              {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 570,
                columnNumber: 19
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(Chip, { size: "small", label: activeCenter.status, color: statusChipColor(activeCenter.status) }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 579,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 569,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Typography, { variant: "h6", sx: { fontWeight: 700, lineHeight: 1.3 }, children: activeCenter.name }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 582,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Typography, { variant: "caption", color: "text.secondary", sx: { display: "block", mt: 0.5 }, children: [
            "📍 ",
            activeCenter.location
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 585,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Divider, { sx: { my: 1.5 } }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 589,
            columnNumber: 17
          }, this),
          activeCenter.status === "flagged" && /* @__PURE__ */ jsxDEV(Alert, { severity: "error", sx: { mb: 2 }, children: [
            /* @__PURE__ */ jsxDEV("strong", { children: "DoSJE Audit Spotlight:" }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 593,
              columnNumber: 21
            }, this),
            " this center is flagged — CCTV tamper or headcount anomalies were detected. Physically verify before releasing further grants."
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 592,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV(Box, { sx: { bgcolor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 2, p: 1.75, mb: 2 }, children: [
            /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.75, mb: 1 }, children: [
              /* @__PURE__ */ jsxDEV(PersonIcon, { sx: { fontSize: 16, color: "#0369a1" } }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 600,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(
                Typography,
                {
                  variant: "caption",
                  sx: { fontWeight: 800, letterSpacing: 0.6, color: "#0369a1", textTransform: "uppercase" },
                  children: "Center Head / In-charge"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                  lineNumber: 601,
                  columnNumber: 21
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 599,
              columnNumber: 19
            }, this),
            activeCenter.head ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV(Typography, { sx: { fontWeight: 700, fontSize: 15 }, children: activeCenter.head.name }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 610,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV(Typography, { variant: "body2", color: "text.secondary", sx: { mb: 1 }, children: activeCenter.head.designation }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 611,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV(Stack, { direction: "row", spacing: 1, flexWrap: "wrap", useFlexGap: true, children: [
                activeCenter.head.phone && /* @__PURE__ */ jsxDEV(
                  Chip,
                  {
                    component: "a",
                    href: `tel:${activeCenter.head.phone}`,
                    clickable: true,
                    size: "small",
                    icon: /* @__PURE__ */ jsxDEV(PhoneIcon, { sx: { fontSize: 14 } }, void 0, false, {
                      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                      lineNumber: 621,
                      columnNumber: 29
                    }, this),
                    label: activeCenter.head.phone,
                    variant: "outlined"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                    lineNumber: 616,
                    columnNumber: 21
                  },
                  this
                ),
                activeCenter.head.email && /* @__PURE__ */ jsxDEV(
                  Chip,
                  {
                    component: "a",
                    href: `mailto:${activeCenter.head.email}`,
                    clickable: true,
                    size: "small",
                    icon: /* @__PURE__ */ jsxDEV(EmailIcon, { sx: { fontSize: 14 } }, void 0, false, {
                      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                      lineNumber: 632,
                      columnNumber: 29
                    }, this),
                    label: activeCenter.head.email,
                    variant: "outlined"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                    lineNumber: 627,
                    columnNumber: 21
                  },
                  this
                ),
                activeCenter.head.since && /* @__PURE__ */ jsxDEV(Chip, { size: "small", label: `In-charge since ${activeCenter.head.since}`, variant: "outlined" }, void 0, false, {
                  fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                  lineNumber: 638,
                  columnNumber: 21
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 614,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV(Stack, { direction: "row", spacing: 1, sx: { mt: 1.25 }, flexWrap: "wrap", useFlexGap: true, children: [
                activeCenter.head.phone && /* @__PURE__ */ jsxDEV(
                  Button,
                  {
                    component: "a",
                    href: `tel:${activeCenter.head.phone}`,
                    size: "small",
                    variant: "outlined",
                    startIcon: /* @__PURE__ */ jsxDEV(PhoneIcon, {}, void 0, false, {
                      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                      lineNumber: 648,
                      columnNumber: 34
                    }, this),
                    children: "Call head"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                    lineNumber: 643,
                    columnNumber: 21
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  Button,
                  {
                    size: "small",
                    variant: "contained",
                    startIcon: /* @__PURE__ */ jsxDEV(VideocamIcon, {}, void 0, false, {
                      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                      lineNumber: 656,
                      columnNumber: 34
                    }, this),
                    onClick: () => startVideoCall(activeCenter),
                    disabled: vcBusy === activeCenter.id,
                    children: vcBusy === activeCenter.id ? "Connecting…" : "Video call head"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                    lineNumber: 653,
                    columnNumber: 25
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 641,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 609,
              columnNumber: 17
            }, this) : /* @__PURE__ */ jsxDEV(Typography, { variant: "body2", color: "text.secondary", children: "Head-of-center details are not on file for this facility yet." }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 665,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 598,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Box, { sx: { bgcolor: "#f8fafc", p: 1.5, borderRadius: 1.5, mb: 2 }, children: /* @__PURE__ */ jsxDEV(Grid, { container: true, spacing: 1, sx: { fontSize: 12 }, children: [
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "Sanctioned Budget:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 674,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700 }, children: [
                "₹",
                (activeCenter.budget || 0).toLocaleString("en-IN")
              ] }, void 0, true, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 675,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 673,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "Sanction Code:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 678,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700, fontSize: 11 }, children: activeCenter.sanction_code || "—" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 679,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 677,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, sx: { mt: 1 }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "Sanctioned Capacity:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 682,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700 }, children: activeCenter.sanctioned_capacity ?? "—" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 683,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 681,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, sx: { mt: 1 }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "Verified Headcount:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 686,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700 }, children: activeCenter.verified_headcount ?? "—" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 687,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 685,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, sx: { mt: 1 }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "AEBAS Punches:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 690,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700 }, children: activeCenter.aebas_punch_count ?? "—" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 691,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 689,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, sx: { mt: 1 }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "Discrepancy Δ:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 694,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV(
                "div",
                {
                  style: {
                    fontWeight: 700,
                    color: (activeCenter.discrepancy_delta || 0) > 5 ? "#dc2626" : "#059669"
                  },
                  children: activeCenter.discrepancy_delta ?? "—"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                  lineNumber: 695,
                  columnNumber: 23
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 693,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, sx: { mt: 1 }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "NavIC Coordinates:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 705,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700 }, children: activeCenter.geo_coords?.lat != null ? `${activeCenter.geo_coords.lat.toFixed(4)}°N, ${activeCenter.geo_coords.lng.toFixed(4)}°E` : "—" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 706,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 704,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, sx: { mt: 1 }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "AI Anomaly Status:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 713,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV(
                "div",
                {
                  style: {
                    fontWeight: 700,
                    color: activeCenter.status === "flagged" ? "#ef4444" : "#059669"
                  },
                  children: activeCenter.status === "flagged" ? "HIGH RISK DETECTED" : "NOMINAL"
                },
                void 0,
                false,
                {
                  fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                  lineNumber: 714,
                  columnNumber: 23
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 712,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 672,
            columnNumber: 19
          }, this) }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 671,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }, children: [
            /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.75 }, children: [
              /* @__PURE__ */ jsxDEV(VideocamIcon, { sx: { fontSize: 17, color: "#0e7490" } }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 728,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(Typography, { variant: "subtitle2", sx: { fontWeight: 800, color: "#0e7490", letterSpacing: 0.3 }, children: "GROUND-LEVEL CCTV · LIVE" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 729,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 727,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              Chip,
              {
                size: "small",
                color: onlineCameras ? "success" : "default",
                label: `${onlineCameras}/${activeCameras.length} online`
              },
              void 0,
              false,
              {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 733,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 726,
            columnNumber: 17
          }, this),
          activeCameras.length ? /* @__PURE__ */ jsxDEV(Grid, { container: true, spacing: 1.25, sx: { mb: 2 }, children: activeCameras.map(
            (cam) => /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 12, sm: 6, children: /* @__PURE__ */ jsxDEV(Tooltip, { title: cam.anomaly_note || cam.name, arrow: true, children: /* @__PURE__ */ jsxDEV(
              Paper,
              {
                variant: "outlined",
                sx: { overflow: "hidden", borderRadius: 1.5, borderColor: cam.online ? "#bae6fd" : "#e2e8f0" },
                children: [
                  /* @__PURE__ */ jsxDEV(Box, { sx: { position: "relative", bgcolor: "#0f172a" }, children: [
                    cam.online ? /* @__PURE__ */ jsxDEV(
                      Box,
                      {
                        component: "img",
                        src: `${monitoringAPI.snapshotUrl(cam.id)}&frame=${tick}`,
                        alt: cam.name,
                        sx: { display: "block", width: "100%", height: 108, objectFit: "cover" }
                      },
                      void 0,
                      false,
                      {
                        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                        lineNumber: 751,
                        columnNumber: 25
                      },
                      this
                    ) : /* @__PURE__ */ jsxDEV(
                      Box,
                      {
                        sx: {
                          height: 108,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#94a3b8",
                          gap: 0.5
                        },
                        children: [
                          /* @__PURE__ */ jsxDEV(WarningIcon, { sx: { fontSize: 22 } }, void 0, false, {
                            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                            lineNumber: 764,
                            columnNumber: 35
                          }, this),
                          /* @__PURE__ */ jsxDEV(Typography, { variant: "caption", children: "Feed offline" }, void 0, false, {
                            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                            lineNumber: 765,
                            columnNumber: 35
                          }, this)
                        ]
                      },
                      void 0,
                      true,
                      {
                        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                        lineNumber: 758,
                        columnNumber: 25
                      },
                      this
                    ),
                    /* @__PURE__ */ jsxDEV(
                      Chip,
                      {
                        label: cam.online ? "● LIVE" : "OFFLINE",
                        size: "small",
                        color: cam.online ? "success" : "default",
                        sx: { position: "absolute", top: 6, left: 6, height: 19, fontSize: 10, fontWeight: 800 }
                      },
                      void 0,
                      false,
                      {
                        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                        lineNumber: 768,
                        columnNumber: 31
                      },
                      this
                    ),
                    cam.tamper_flag && cam.tamper_flag !== "normal" && /* @__PURE__ */ jsxDEV(
                      Chip,
                      {
                        label: cam.tamper_flag.replace(/_/g, " "),
                        size: "small",
                        color: "error",
                        sx: { position: "absolute", top: 6, right: 6, height: 19, fontSize: 10, fontWeight: 700 }
                      },
                      void 0,
                      false,
                      {
                        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                        lineNumber: 775,
                        columnNumber: 25
                      },
                      this
                    )
                  ] }, void 0, true, {
                    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                    lineNumber: 749,
                    columnNumber: 29
                  }, this),
                  /* @__PURE__ */ jsxDEV(Box, { sx: { px: 1, py: 0.75 }, children: [
                    /* @__PURE__ */ jsxDEV(Typography, { noWrap: true, sx: { fontSize: 11.5, fontWeight: 700 }, title: cam.name, children: cam.name }, void 0, false, {
                      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                      lineNumber: 784,
                      columnNumber: 31
                    }, this),
                    /* @__PURE__ */ jsxDEV(Typography, { noWrap: true, variant: "caption", color: "text.secondary", title: cam.location, children: cam.location }, void 0, false, {
                      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                      lineNumber: 787,
                      columnNumber: 31
                    }, this),
                    cam.detected_headcount != null && /* @__PURE__ */ jsxDEV(
                      Typography,
                      {
                        variant: "caption",
                        sx: {
                          display: "block",
                          color: cam.detected_headcount === cam.aebas_punch_count ? "#059669" : "#dc2626"
                        },
                        children: [
                          "AI headcount ",
                          cam.detected_headcount,
                          " · AEBAS ",
                          cam.aebas_punch_count
                        ]
                      },
                      void 0,
                      true,
                      {
                        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                        lineNumber: 791,
                        columnNumber: 25
                      },
                      this
                    )
                  ] }, void 0, true, {
                    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                    lineNumber: 783,
                    columnNumber: 29
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 745,
                columnNumber: 27
              },
              this
            ) }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 744,
              columnNumber: 25
            }, this) }, cam.id, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 743,
              columnNumber: 17
            }, this)
          ) }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 741,
            columnNumber: 15
          }, this) : /* @__PURE__ */ jsxDEV(Alert, { severity: "info", sx: { mb: 2 }, children: "No ground-level cameras registered for this center yet." }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 808,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV(Stack, { direction: "row", spacing: 1, flexWrap: "wrap", useFlexGap: true, children: [
            /* @__PURE__ */ jsxDEV(
              Button,
              {
                size: "small",
                variant: "contained",
                startIcon: /* @__PURE__ */ jsxDEV(VideocamIcon, {}, void 0, false, {
                  fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                  lineNumber: 817,
                  columnNumber: 30
                }, this),
                onClick: () => navigate("/live"),
                children: "Live CCTV Wall"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 814,
                columnNumber: 19
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(Button, { size: "small", variant: "outlined", onClick: () => navigate("/inspections"), children: "Inspection Records" }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 822,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              Button,
              {
                size: "small",
                variant: "outlined",
                startIcon: /* @__PURE__ */ jsxDEV(ShieldIcon, {}, void 0, false, {
                  fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                  lineNumber: 828,
                  columnNumber: 30
                }, this),
                onClick: () => navigate("/atr"),
                children: "Digital ATR"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 825,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 813,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 568,
          columnNumber: 13
        }, this) : /* @__PURE__ */ jsxDEV(Paper, { sx: { p: 3, textAlign: "center", color: "#64748b" }, children: "Select a facility on the map to inspect its center head and ground-level CCTV cameras." }, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 836,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 523,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 522,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
      lineNumber: 493,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(
      Snackbar,
      {
        open: Boolean(vcNotice),
        autoHideDuration: 7e3,
        onClose: () => setVcNotice(null),
        message: vcNotice,
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      },
      void 0,
      false,
      {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 844,
        columnNumber: 7
      },
      this
    )
  ] }, void 0, true, {
    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
    lineNumber: 418,
    columnNumber: 5
  }, this);
};
_s(GISMap, "GKE+8WXScpXPXIujWLE890GvVYE=", false, function() {
  return [useNavigate];
});
_c = GISMap;
export default GISMap;
var _c;
$RefreshReg$(_c, "GISMap");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports)
        return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx", currentExports, nextExports);
      if (invalidateMessage)
        import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,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TUFBTTtBQUFBLGdCQUFFO0FBQUE7QUFBQSxjQUpsQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsWUFPQTtBQUFBLGVBbkJGO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBb0JBO0FBQUEsYUF6UUY7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQTBRQSxJQUVBLHVCQUFDLFNBQU0sSUFBSSxFQUFFeUgsR0FBRyxHQUFHa0QsV0FBVyxVQUFValEsT0FBTyxVQUFVLEdBQUcsc0dBQTVEO0FBQUE7QUFBQTtBQUFBO0FBQUEsZUFFQTtBQUFBLFdBM1RKO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUE2VEEsS0E5VEY7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQStUQTtBQUFBLFNBNVZGO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0E2VkE7QUFBQSxJQUVBO0FBQUEsTUFBQztBQUFBO0FBQUEsUUFDQyxNQUFNa1EsUUFBUWhMLFFBQVE7QUFBQSxRQUN0QixrQkFBa0I7QUFBQSxRQUNsQixTQUFTLE1BQU1DLFlBQVksSUFBSTtBQUFBLFFBQy9CLFNBQVNEO0FBQUFBLFFBQ1QsY0FBYyxFQUFFaUwsVUFBVSxVQUFVQyxZQUFZLFNBQVM7QUFBQTtBQUFBLE1BTDNEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUs2RDtBQUFBLE9BL2EvRDtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBaWJBO0FBRUo7QUFBRTVNLEdBenNCSUQsUUFBTTtBQUFBLFVBbUJPM0QsV0FBVztBQUFBO0FBQUEsS0FuQnhCMkQ7QUEyc0JOLGVBQWVBO0FBQU8sSUFBQThNO0FBQUEsYUFBQUEsSUFBQSIsIm5hbWVzIjpbIlJlYWN0IiwidXNlU3RhdGUiLCJ1c2VFZmZlY3QiLCJ1c2VSZWYiLCJ1c2VNZW1vIiwiQm94IiwiVHlwb2dyYXBoeSIsIlBhcGVyIiwiR3JpZCIsIkNoaXAiLCJCdXR0b24iLCJBbGVydCIsIlN0YWNrIiwiRGl2aWRlciIsIlRvb2x0aXAiLCJDaXJjdWxhclByb2dyZXNzIiwiU25hY2tiYXIiLCJMb2NhdGlvbk9uIiwiTG9jYXRpb25JY29uIiwiVmlkZW9jYW0iLCJWaWRlb2NhbUljb24iLCJXYXJuaW5nIiwiV2FybmluZ0ljb24iLCJSZWZyZXNoIiwiUmVmcmVzaEljb24iLCJTaGllbGQiLCJTaGllbGRJY29uIiwiUGhvbmUiLCJQaG9uZUljb24iLCJFbWFpbCIsIkVtYWlsSWNvbiIsIlBlcnNvbiIsIlBlcnNvbkljb24iLCJQdWJsaWMiLCJQdWJsaWNJY29uIiwiZ2lzQVBJIiwibW9uaXRvcmluZ0FQSSIsInZjQVBJIiwidXNlTmF2aWdhdGUiLCJTQ0hFTUVfQkFER0VTIiwiQVZZQVkiLCJsYWJlbCIsImNvbG9yIiwiYmciLCJOQVBERFIiLCJTSVBEQSIsIlNDSEVNRV9DT0xPUlMiLCJJTkRJQV9DRU5URVIiLCJsYXQiLCJsbmciLCJjZW50ZXJDb2xvciIsImNlbnRlciIsInN0YXR1cyIsInNjaGVtZSIsInN0YXR1c0NoaXBDb2xvciIsIlBJTl9DQVJEX0NTUyIsImJ1aWxkUGluQ2FyZCIsIm9uVmlkZW9DYWxsIiwiaGVhZCIsImVsIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwiaW5uZXJIVE1MIiwibmFtZSIsImxvY2F0aW9uIiwiZGVzaWduYXRpb24iLCJwaG9uZSIsInF1ZXJ5U2VsZWN0b3IiLCJhZGRFdmVudExpc3RlbmVyIiwiZXZlbnQiLCJwcmV2ZW50RGVmYXVsdCIsInN0b3BQcm9wYWdhdGlvbiIsImxvYWRHb29nbGVNYXBzIiwia2V5IiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJ3aW5kb3ciLCJnb29nbGUiLCJtYXBzIiwiRXJyb3IiLCJmYWlsIiwid2h5IiwiZXhpc3RpbmciLCJnZXRFbGVtZW50QnlJZCIsImNoZWNrIiwidW5kZWZpbmVkIiwiX19zZE1hcHNDYWxsYmFjayIsInNjcmlwdCIsImlkIiwiYXN5bmMiLCJzcmMiLCJlbmNvZGVVUklDb21wb25lbnQiLCJvbmVycm9yIiwiYXBwZW5kQ2hpbGQiLCJzZXRUaW1lb3V0IiwiR0lTTWFwIiwiX3MiLCJkYXRhIiwic2V0RGF0YSIsImxvYWRpbmciLCJzZXRMb2FkaW5nIiwiZXJyb3IiLCJzZXRFcnJvciIsInNlbGVjdGVkU2NoZW1lIiwic2V0U2VsZWN0ZWRTY2hlbWUiLCJhY3RpdmVJZCIsInNldEFjdGl2ZUlkIiwiZW5naW5lIiwic2V0RW5naW5lIiwiZW5naW5lTm90ZSIsInNldEVuZ2luZU5vdGUiLCJsZWFmbGV0UmVhZHkiLCJzZXRMZWFmbGV0UmVhZHkiLCJ0aWNrIiwic2V0VGljayIsIm1hcFJlZiIsImdSZWYiLCJsUmVmIiwicGluQ2FyZHNSZWYiLCJNYXAiLCJwaW5UaW1lclJlZiIsInZjSGFuZGxlclJlZiIsInZjTm90aWNlIiwic2V0VmNOb3RpY2UiLCJ2Y0J1c3kiLCJzZXRWY0J1c3kiLCJuYXZpZ2F0ZSIsImNlbnRlcnMiLCJmaWx0ZXJlZENlbnRlcnMiLCJmaWx0ZXIiLCJjIiwidG9VcHBlckNhc2UiLCJhY3RpdmVDZW50ZXIiLCJmaW5kIiwiYWN0aXZlQ2FtZXJhcyIsImNhbWVyYXMiLCJvbmxpbmVDYW1lcmFzIiwib25saW5lIiwibGVuZ3RoIiwiaGlkZVBpbkNhcmQiLCJjdXJyZW50IiwiaW5mbyIsImNsb3NlIiwic2NoZWR1bGVQaW5DbG9zZSIsImNsZWFyVGltZW91dCIsImdldFBpbkNhcmQiLCJoYXMiLCJjYXJkIiwic2V0IiwiZ2V0Iiwib3BlblBpbkNhcmQiLCJtYXJrZXIiLCJzZXRDb250ZW50Iiwib3BlbiIsIm1hcCIsImFuY2hvciIsInN0YXJ0VmlkZW9DYWxsIiwiY2FyZEJ1dHRvbiIsImRpc2FibGVkIiwidGV4dENvbnRlbnQiLCJ3aW4iLCJib2R5IiwiY3JlYXRlIiwicHJvamVjdF9pZCIsIm1vZGUiLCJzZXNzaW9uIiwiam9pbl91cmwiLCJocmVmIiwicm9vbV9pZCIsIm9mZmljaWFsX25hbWUiLCJlcnIiLCJyZXNwb25zZSIsIm1lc3NhZ2UiLCJjbGVhciIsImxvYWQiLCJyZXMiLCJjb25zb2xlIiwiY2FuY2VsbGVkIiwiYXBpX2tleSIsInRoZW4iLCJjYXRjaCIsImciLCJ6b29tIiwibWFwVHlwZUNvbnRyb2wiLCJzdHJlZXRWaWV3Q29udHJvbCIsImZ1bGxzY3JlZW5Db250cm9sIiwiY2xpY2thYmxlSWNvbnMiLCJtYXJrZXJzIiwiSW5mb1dpbmRvdyIsImRpc2FibGVBdXRvUGFuIiwiYWRkTGlzdGVuZXIiLCJnbV9hdXRoRmFpbHVyZSIsImZvckVhY2giLCJtIiwic2V0TWFwIiwiZGlzcG9zZWQiLCJMIiwiZGVmYXVsdCIsInNldFZpZXciLCJ0aWxlTGF5ZXIiLCJtYXhab29tIiwiYXR0cmlidXRpb24iLCJhZGRUbyIsImxheWVyIiwibGF5ZXJHcm91cCIsInJlbW92ZSIsInNlbGVjdGVkIiwiTWFya2VyIiwicG9zaXRpb24iLCJnZW9fY29vcmRzIiwidGl0bGUiLCJpY29uIiwicGF0aCIsIlN5bWJvbFBhdGgiLCJDSVJDTEUiLCJzY2FsZSIsImZpbGxDb2xvciIsImZpbGxPcGFjaXR5Iiwic3Ryb2tlQ29sb3IiLCJzdHJva2VXZWlnaHQiLCJwYW5UbyIsImdldFpvb20iLCJzZXRab29tIiwiY2xlYXJMYXllcnMiLCJjaXJjbGVNYXJrZXIiLCJyYWRpdXMiLCJ3ZWlnaHQiLCJiaW5kVG9vbHRpcCIsImRpcmVjdGlvbiIsIm9mZnNldCIsIm9wYWNpdHkiLCJpbnRlcmFjdGl2ZSIsIm9uIiwiTWF0aCIsIm1heCIsImludGVydmFsIiwic2V0SW50ZXJ2YWwiLCJ0IiwiY2xlYXJJbnRlcnZhbCIsImRpc3BsYXkiLCJqdXN0aWZ5Q29udGVudCIsImFsaWduSXRlbXMiLCJtaW5IZWlnaHQiLCJtYiIsImZsZXhXcmFwIiwiZ2FwIiwiZm9udFdlaWdodCIsInAiLCJtciIsInMiLCJjdXJzb3IiLCJmb250U2l6ZSIsIndpZHRoIiwiaGVpZ2h0IiwiYm9yZGVyUmFkaXVzIiwiYmdjb2xvciIsInJlZHVjZSIsInN1bSIsImNhbWVyYV9jb3VudCIsIm92ZXJmbG93IiwiaW5zZXQiLCJmbGV4RGlyZWN0aW9uIiwibXQiLCJweCIsIk9iamVjdCIsImVudHJpZXMiLCJtYXhIZWlnaHQiLCJweSIsImJvcmRlciIsImJvcmRlckNvbG9yIiwiZmxleFNocmluayIsImZsZXhHcm93IiwiY2FtZXJhc19vbmxpbmUiLCJsaW5lSGVpZ2h0IiwibXkiLCJsZXR0ZXJTcGFjaW5nIiwidGV4dFRyYW5zZm9ybSIsImVtYWlsIiwic2luY2UiLCJidWRnZXQiLCJ0b0xvY2FsZVN0cmluZyIsInNhbmN0aW9uX2NvZGUiLCJzYW5jdGlvbmVkX2NhcGFjaXR5IiwidmVyaWZpZWRfaGVhZGNvdW50IiwiYWViYXNfcHVuY2hfY291bnQiLCJkaXNjcmVwYW5jeV9kZWx0YSIsInRvRml4ZWQiLCJjYW0iLCJhbm9tYWx5X25vdGUiLCJzbmFwc2hvdFVybCIsIm9iamVjdEZpdCIsInRvcCIsImxlZnQiLCJ0YW1wZXJfZmxhZyIsInJlcGxhY2UiLCJyaWdodCIsImRldGVjdGVkX2hlYWRjb3VudCIsInRleHRBbGlnbiIsIkJvb2xlYW4iLCJ2ZXJ0aWNhbCIsImhvcml6b250YWwiLCJfYyJdLCJzb3VyY2VzIjpbIkdJU01hcC5qc3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0LCB7IHVzZVN0YXRlLCB1c2VFZmZlY3QsIHVzZVJlZiwgdXNlTWVtbyB9IGZyb20gJ3JlYWN0JztcclxuaW1wb3J0IHtcclxuICBCb3gsIFR5cG9ncmFwaHksIFBhcGVyLCBHcmlkLCBDaGlwLCBCdXR0b24sIEFsZXJ0LCBTdGFjaywgRGl2aWRlciwgVG9vbHRpcCxcclxuICBDaXJjdWxhclByb2dyZXNzLCBTbmFja2JhcixcclxufSBmcm9tICdAbXVpL21hdGVyaWFsJztcclxuaW1wb3J0IHtcclxuICBMb2NhdGlvbk9uIGFzIExvY2F0aW9uSWNvbixcclxuICBWaWRlb2NhbSBhcyBWaWRlb2NhbUljb24sXHJcbiAgV2FybmluZyBhcyBXYXJuaW5nSWNvbixcclxuICBSZWZyZXNoIGFzIFJlZnJlc2hJY29uLFxyXG4gIFNoaWVsZCBhcyBTaGllbGRJY29uLFxyXG4gIFBob25lIGFzIFBob25lSWNvbixcclxuICBFbWFpbCBhcyBFbWFpbEljb24sXHJcbiAgUGVyc29uIGFzIFBlcnNvbkljb24sXHJcbiAgUHVibGljIGFzIFB1YmxpY0ljb24sXHJcbn0gZnJvbSAnQG11aS9pY29ucy1tYXRlcmlhbCc7XHJcbmltcG9ydCB7IGdpc0FQSSwgbW9uaXRvcmluZ0FQSSwgdmNBUEkgfSBmcm9tICcuLi9zZXJ2aWNlcy9hcGknO1xyXG5pbXBvcnQgeyB1c2VOYXZpZ2F0ZSB9IGZyb20gJ3JlYWN0LXJvdXRlci1kb20nO1xyXG5cclxuY29uc3QgU0NIRU1FX0JBREdFUyA9IHtcclxuICBBVllBWTogeyBsYWJlbDogJ0FWWUFZIChTZW5pb3IgQ2l0aXplbnMpJywgY29sb3I6ICcjMDI4NGM3JywgYmc6ICcjZTBmMmZlJyB9LFxyXG4gIE5BUEREUjogeyBsYWJlbDogJ05BUEREUiAoRGUtQWRkaWN0aW9uKScsIGNvbG9yOiAnI2Q5NzcwNicsIGJnOiAnI2ZlZjNjNycgfSxcclxuICBTSVBEQTogeyBsYWJlbDogJ1NJUERBIChQd0QgU2tpbGxzKScsIGNvbG9yOiAnIzA1OTY2OScsIGJnOiAnI2QxZmFlNScgfSxcclxufTtcclxuXHJcbmNvbnN0IFNDSEVNRV9DT0xPUlMgPSB7IEFWWUFZOiAnIzAyODRjNycsIE5BUEREUjogJyNkOTc3MDYnLCBTSVBEQTogJyMwNTk2NjknIH07XHJcbmNvbnN0IElORElBX0NFTlRFUiA9IHsgbGF0OiAyMy40LCBsbmc6IDc4LjkgfTtcclxuXHJcbmNvbnN0IGNlbnRlckNvbG9yID0gKGNlbnRlcikgPT5cclxuICBjZW50ZXIuc3RhdHVzID09PSAnZmxhZ2dlZCcgPyAnI2RjMjYyNicgOiBTQ0hFTUVfQ09MT1JTW2NlbnRlci5zY2hlbWVdIHx8ICcjNjQ3NDhiJztcclxuXHJcbmNvbnN0IHN0YXR1c0NoaXBDb2xvciA9IChzdGF0dXMpID0+XHJcbiAgc3RhdHVzID09PSAnZmxhZ2dlZCcgPyAnZXJyb3InIDogc3RhdHVzID09PSAnY29tcGxldGVkJyA/ICdzdWNjZXNzJyA6ICdwcmltYXJ5JztcclxuXHJcbi8qIFN0eWxpbmcgZm9yIHRoZSBwaW4gaG92ZXIgY2FyZCAodXNlZCBpbnNpZGUgYSBHb29nbGUgSW5mb1dpbmRvdyBhbmQgYVxyXG4gICBMZWFmbGV0IHRvb2x0aXAsIHNvIGl0IGxpdmVzIGluIGl0cyBvd24gY2xhc3MgcmF0aGVyIHRoYW4gTVVJIHN4KS4gKi9cclxuY29uc3QgUElOX0NBUkRfQ1NTID0gYFxyXG4uc2QtcGluLWNhcmQgeyBtaW4td2lkdGg6IDIzNnB4OyBtYXgtd2lkdGg6IDI2OHB4OyBmb250LWZhbWlseTogUm9ib3RvLCAnU2Vnb2UgVUknLCBzYW5zLXNlcmlmOyBjb2xvcjogIzBmMTcyYTsgYmFja2dyb3VuZDogI2ZmZjsgYm9yZGVyLXJhZGl1czogMTBweDsgYm9yZGVyOiAxcHggc29saWQgI2UyZThmMDsgYm94LXNoYWRvdzogMCA2cHggMjRweCByZ2JhKDE1LCAyMywgNDIsIDAuMTgpOyBwYWRkaW5nOiAxMHB4IDEycHg7IH1cclxuLnNkLXBpbi1jYXJkIC5zZC1zY2hlbWUgeyBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7IGZvbnQtc2l6ZTogMTBweDsgZm9udC13ZWlnaHQ6IDgwMDsgbGV0dGVyLXNwYWNpbmc6IDAuNHB4OyBwYWRkaW5nOiAycHggOHB4OyBib3JkZXItcmFkaXVzOiA5OTlweDsgfVxyXG4uc2QtcGluLWNhcmQgLnNkLW5hbWUgeyBmb250LXNpemU6IDEzcHg7IGZvbnQtd2VpZ2h0OiA3MDA7IGxpbmUtaGVpZ2h0OiAxLjM7IG1hcmdpbjogNnB4IDAgMnB4OyB9XHJcbi5zZC1waW4tY2FyZCAuc2QtbG9jIHsgZm9udC1zaXplOiAxMXB4OyBjb2xvcjogIzY0NzQ4YjsgfVxyXG4uc2QtcGluLWNhcmQgLnNkLWhlYWRib3ggeyBiYWNrZ3JvdW5kOiAjZjBmOWZmOyBib3JkZXI6IDFweCBzb2xpZCAjYmFlNmZkOyBib3JkZXItcmFkaXVzOiA4cHg7IHBhZGRpbmc6IDhweCAxMHB4OyBtYXJnaW46IDhweCAwOyB9XHJcbi5zZC1waW4tY2FyZCAuc2QtaGVhZGxhYmVsIHsgZm9udC1zaXplOiA5LjVweDsgZm9udC13ZWlnaHQ6IDgwMDsgY29sb3I6ICMwMzY5YTE7IGxldHRlci1zcGFjaW5nOiAwLjZweDsgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTsgfVxyXG4uc2QtcGluLWNhcmQgLnNkLWhlYWRuYW1lIHsgZm9udC1zaXplOiAxMi41cHg7IGZvbnQtd2VpZ2h0OiA3MDA7IG1hcmdpbi10b3A6IDJweDsgfVxyXG4uc2QtcGluLWNhcmQgLnNkLWhlYWRkZXNpZyB7IGZvbnQtc2l6ZTogMTFweDsgY29sb3I6ICM0NzU1Njk7IH1cclxuLnNkLXBpbi1jYXJkIC5zZC1hY3Rpb25zIHsgZGlzcGxheTogZmxleDsgZ2FwOiA2cHg7IH1cclxuLnNkLXBpbi1jYXJkIC5zZC1idG4geyBmbGV4OiAxOyBkaXNwbGF5OiBpbmxpbmUtZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7IGdhcDogNHB4OyBmb250LXNpemU6IDExLjVweDsgZm9udC13ZWlnaHQ6IDcwMDsgcGFkZGluZzogNnB4IDhweDsgYm9yZGVyLXJhZGl1czogOHB4OyBjdXJzb3I6IHBvaW50ZXI7IHRleHQtZGVjb3JhdGlvbjogbm9uZTsgYm9yZGVyOiAxcHggc29saWQgdHJhbnNwYXJlbnQ7IGZvbnQtZmFtaWx5OiBpbmhlcml0OyB9XHJcbi5zZC1waW4tY2FyZCAuc2QtY2FsbCB7IGJhY2tncm91bmQ6ICNlY2ZkZjU7IGJvcmRlci1jb2xvcjogI2E3ZjNkMDsgY29sb3I6ICMwNDc4NTc7IH1cclxuLnNkLXBpbi1jYXJkIC5zZC1jYWxsOmhvdmVyIHsgYmFja2dyb3VuZDogI2QxZmFlNTsgfVxyXG4uc2QtcGluLWNhcmQgLnNkLXZjIHsgYmFja2dyb3VuZDogI2VlZjJmZjsgYm9yZGVyLWNvbG9yOiAjYzdkMmZlOyBjb2xvcjogIzQzMzhjYTsgfVxyXG4uc2QtcGluLWNhcmQgLnNkLXZjOmhvdmVyIHsgYmFja2dyb3VuZDogI2UwZTdmZjsgfVxyXG4uc2QtcGluLWNhcmQgLnNkLXZjW2Rpc2FibGVkXSB7IG9wYWNpdHk6IDAuNjU7IGN1cnNvcjogd2FpdDsgfVxyXG4uc2QtcGluLWNhcmQgLnNkLWhpbnQgeyBmb250LXNpemU6IDEwcHg7IGNvbG9yOiAjOTRhM2I4OyBtYXJnaW4tdG9wOiA2cHg7IH1cclxuLmxlYWZsZXQtdG9vbHRpcC5zZC1waW4tdGlwIHsgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7IGJvcmRlcjogbm9uZTsgYm94LXNoYWRvdzogbm9uZTsgcGFkZGluZzogMDsgd2hpdGUtc3BhY2U6IG5vcm1hbDsgfVxyXG4ubGVhZmxldC10b29sdGlwLnNkLXBpbi10aXA6OmJlZm9yZSB7IGRpc3BsYXk6IG5vbmU7IH1cclxuYDtcclxuXHJcbi8qKiBCdWlsZHMgdGhlIGhvdmVyIGNhcmQgc2hvd24gYWJvdmUgYSBjZW50ZXIgcGluOiBkZXBhcnRtZW50LCBjdXJyZW50IGhlYWQsXHJcbiAqICBhIHRhcC10by1jYWxsIGxpbmsgYW5kIGEgbGl2ZSB2aWRlby1jYWxsIGJ1dHRvbi4gKi9cclxuY29uc3QgYnVpbGRQaW5DYXJkID0gKGNlbnRlciwgb25WaWRlb0NhbGwpID0+IHtcclxuICBjb25zdCBzY2hlbWUgPSBTQ0hFTUVfQkFER0VTW2NlbnRlci5zY2hlbWVdIHx8IHtcclxuICAgIGxhYmVsOiBjZW50ZXIuc2NoZW1lIHx8ICdEZXBhcnRtZW50JyxcclxuICAgIGNvbG9yOiAnIzQ3NTU2OScsXHJcbiAgICBiZzogJyNmMWY1ZjknLFxyXG4gIH07XHJcbiAgY29uc3QgaGVhZCA9IGNlbnRlci5oZWFkIHx8IHt9O1xyXG4gIGNvbnN0IGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgZWwuY2xhc3NOYW1lID0gJ3NkLXBpbi1jYXJkJztcclxuICBlbC5pbm5lckhUTUwgPSBgXHJcbiAgICA8c3BhbiBjbGFzcz1cInNkLXNjaGVtZVwiIHN0eWxlPVwiYmFja2dyb3VuZDoke3NjaGVtZS5iZ307Y29sb3I6JHtzY2hlbWUuY29sb3J9O1wiPiR7c2NoZW1lLmxhYmVsfTwvc3Bhbj5cclxuICAgIDxkaXYgY2xhc3M9XCJzZC1uYW1lXCI+JHtjZW50ZXIubmFtZX08L2Rpdj5cclxuICAgIDxkaXYgY2xhc3M9XCJzZC1sb2NcIj7wn5ONICR7Y2VudGVyLmxvY2F0aW9uIHx8ICcnfTwvZGl2PlxyXG4gICAgPGRpdiBjbGFzcz1cInNkLWhlYWRib3hcIj5cclxuICAgICAgPGRpdiBjbGFzcz1cInNkLWhlYWRsYWJlbFwiPkN1cnJlbnQgSGVhZDwvZGl2PlxyXG4gICAgICA8ZGl2IGNsYXNzPVwic2QtaGVhZG5hbWVcIj4ke2hlYWQubmFtZSB8fCAnSGVhZCBub3Qgb24gZmlsZSd9PC9kaXY+XHJcbiAgICAgIDxkaXYgY2xhc3M9XCJzZC1oZWFkZGVzaWdcIj4ke2hlYWQuZGVzaWduYXRpb24gfHwgJyd9PC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICAgIDxkaXYgY2xhc3M9XCJzZC1hY3Rpb25zXCI+XHJcbiAgICAgICR7aGVhZC5waG9uZSA/IGA8YSBjbGFzcz1cInNkLWJ0biBzZC1jYWxsXCIgaHJlZj1cInRlbDoke2hlYWQucGhvbmV9XCI+8J+TniBDYWxsPC9hPmAgOiAnJ31cclxuICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJzZC1idG4gc2QtdmNcIj7wn46lIFZpZGVvIGNhbGw8L2J1dHRvbj5cclxuICAgIDwvZGl2PlxyXG4gICAgPGRpdiBjbGFzcz1cInNkLWhpbnRcIj5DbGljayB0aGUgcGluIGZvciB0aGUgZnVsbCBkcmlsbC1kb3duIChDQ1RWLCBjb21wbGlhbmNlKTwvZGl2PmA7XHJcbiAgZWwucXVlcnlTZWxlY3RvcignLnNkLXZjJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIG9uVmlkZW9DYWxsKGNlbnRlcik7XHJcbiAgfSk7XHJcbiAgcmV0dXJuIGVsO1xyXG59O1xyXG5cclxuLyoqIExvYWRzIHRoZSBHb29nbGUgTWFwcyBKUyBBUEkgb25jZSwgd2l0aCB0aGUga2V5IHNlcnZlZCBieSBvdXIgYmFja2VuZC4gKi9cclxuY29uc3QgbG9hZEdvb2dsZU1hcHMgPSAoa2V5KSA9PlxyXG4gIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgIGlmICh3aW5kb3cuZ29vZ2xlICYmIHdpbmRvdy5nb29nbGUubWFwcykgcmV0dXJuIHJlc29sdmUoKTtcclxuICAgIGlmICgha2V5KSByZXR1cm4gcmVqZWN0KG5ldyBFcnJvcignbm8ta2V5JykpO1xyXG5cclxuICAgIGNvbnN0IGZhaWwgPSAod2h5KSA9PiByZWplY3QobmV3IEVycm9yKHdoeSkpO1xyXG4gICAgY29uc3QgZXhpc3RpbmcgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2QtZ29vZ2xlLW1hcHMnKTtcclxuICAgIGNvbnN0IGNoZWNrID0gKCkgPT5cclxuICAgICAgd2luZG93Lmdvb2dsZSAmJiB3aW5kb3cuZ29vZ2xlLm1hcHMgPyByZXNvbHZlKCkgOiBmYWlsKCdpbml0LWZhaWxlZCcpO1xyXG5cclxuICAgIGlmIChleGlzdGluZykge1xyXG4gICAgICBleGlzdGluZy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgY2hlY2spO1xyXG4gICAgICBleGlzdGluZy5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsICgpID0+IGZhaWwoJ2xvYWQtZXJyb3InKSk7XHJcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgd2luZG93Ll9fc2RNYXBzQ2FsbGJhY2sgPSBjaGVjaztcclxuICAgIGNvbnN0IHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xyXG4gICAgc2NyaXB0LmlkID0gJ3NkLWdvb2dsZS1tYXBzJztcclxuICAgIHNjcmlwdC5hc3luYyA9IHRydWU7XHJcbiAgICBzY3JpcHQuc3JjID0gYGh0dHBzOi8vbWFwcy5nb29nbGVhcGlzLmNvbS9tYXBzL2FwaS9qcz9rZXk9JHtlbmNvZGVVUklDb21wb25lbnQoa2V5KX0mbG9hZGluZz1hc3luYyZjYWxsYmFjaz1fX3NkTWFwc0NhbGxiYWNrYDtcclxuICAgIHNjcmlwdC5vbmVycm9yID0gKCkgPT4gZmFpbCgnbG9hZC1lcnJvcicpO1xyXG4gICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzY3JpcHQpO1xyXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIGlmICghKHdpbmRvdy5nb29nbGUgJiYgd2luZG93Lmdvb2dsZS5tYXBzKSkgZmFpbCgndGltZW91dCcpO1xyXG4gICAgfSwgMTAwMDApO1xyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICB9KTtcclxuXHJcbmNvbnN0IEdJU01hcCA9ICgpID0+IHtcclxuICBjb25zdCBbZGF0YSwgc2V0RGF0YV0gPSB1c2VTdGF0ZShudWxsKTtcclxuICBjb25zdCBbbG9hZGluZywgc2V0TG9hZGluZ10gPSB1c2VTdGF0ZSh0cnVlKTtcclxuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IHVzZVN0YXRlKG51bGwpO1xyXG4gIGNvbnN0IFtzZWxlY3RlZFNjaGVtZSwgc2V0U2VsZWN0ZWRTY2hlbWVdID0gdXNlU3RhdGUoJ0FMTCcpO1xyXG4gIGNvbnN0IFthY3RpdmVJZCwgc2V0QWN0aXZlSWRdID0gdXNlU3RhdGUobnVsbCk7XHJcbiAgY29uc3QgW2VuZ2luZSwgc2V0RW5naW5lXSA9IHVzZVN0YXRlKCdwZW5kaW5nJyk7IC8vIHBlbmRpbmcgfCBnb29nbGUgfCBsZWFmbGV0XHJcbiAgY29uc3QgW2VuZ2luZU5vdGUsIHNldEVuZ2luZU5vdGVdID0gdXNlU3RhdGUobnVsbCk7XHJcbiAgY29uc3QgW2xlYWZsZXRSZWFkeSwgc2V0TGVhZmxldFJlYWR5XSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbdGljaywgc2V0VGlja10gPSB1c2VTdGF0ZSgwKTtcclxuXHJcbiAgY29uc3QgbWFwUmVmID0gdXNlUmVmKG51bGwpO1xyXG4gIGNvbnN0IGdSZWYgPSB1c2VSZWYobnVsbCk7IC8vIHsgbWFwLCBtYXJrZXJzLCBpbmZvIH1cclxuICBjb25zdCBsUmVmID0gdXNlUmVmKG51bGwpOyAvLyB7IG1hcCwgbGF5ZXIsIEwgfVxyXG4gIGNvbnN0IHBpbkNhcmRzUmVmID0gdXNlUmVmKG5ldyBNYXAoKSk7IC8vIGNlbnRlciBpZCAtPiBob3Zlci1jYXJkIGVsZW1lbnRcclxuICBjb25zdCBwaW5UaW1lclJlZiA9IHVzZVJlZihudWxsKTtcclxuICBjb25zdCB2Y0hhbmRsZXJSZWYgPSB1c2VSZWYobnVsbCk7XHJcbiAgY29uc3QgW3ZjTm90aWNlLCBzZXRWY05vdGljZV0gPSB1c2VTdGF0ZShudWxsKTtcclxuICBjb25zdCBbdmNCdXN5LCBzZXRWY0J1c3ldID0gdXNlU3RhdGUobnVsbCk7XHJcbiAgY29uc3QgbmF2aWdhdGUgPSB1c2VOYXZpZ2F0ZSgpO1xyXG5cclxuICBjb25zdCBjZW50ZXJzID0gdXNlTWVtbygoKSA9PiBkYXRhPy5jZW50ZXJzIHx8IFtdLCBbZGF0YV0pO1xyXG4gIGNvbnN0IGZpbHRlcmVkQ2VudGVycyA9IHVzZU1lbW8oXHJcbiAgICAoKSA9PiBjZW50ZXJzLmZpbHRlcigoYykgPT4gc2VsZWN0ZWRTY2hlbWUgPT09ICdBTEwnIHx8IChjLnNjaGVtZSB8fCAnJykudG9VcHBlckNhc2UoKSA9PT0gc2VsZWN0ZWRTY2hlbWUpLFxyXG4gICAgW2NlbnRlcnMsIHNlbGVjdGVkU2NoZW1lXVxyXG4gICk7XHJcbiAgY29uc3QgYWN0aXZlQ2VudGVyID0gdXNlTWVtbyhcclxuICAgICgpID0+IGZpbHRlcmVkQ2VudGVycy5maW5kKChjKSA9PiBjLmlkID09PSBhY3RpdmVJZCkgfHwgZmlsdGVyZWRDZW50ZXJzWzBdIHx8IG51bGwsXHJcbiAgICBbZmlsdGVyZWRDZW50ZXJzLCBhY3RpdmVJZF1cclxuICApO1xyXG4gIGNvbnN0IGFjdGl2ZUNhbWVyYXMgPSBhY3RpdmVDZW50ZXI/LmNhbWVyYXMgfHwgW107XHJcbiAgY29uc3Qgb25saW5lQ2FtZXJhcyA9IGFjdGl2ZUNhbWVyYXMuZmlsdGVyKChjKSA9PiBjLm9ubGluZSkubGVuZ3RoO1xyXG5cclxuICAvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIHBpbiBob3ZlciBjYXJkcyAqL1xyXG4gIGNvbnN0IGhpZGVQaW5DYXJkID0gKCkgPT4ge1xyXG4gICAgaWYgKGdSZWYuY3VycmVudD8uaW5mbykgZ1JlZi5jdXJyZW50LmluZm8uY2xvc2UoKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBzY2hlZHVsZVBpbkNsb3NlID0gKCkgPT4ge1xyXG4gICAgY2xlYXJUaW1lb3V0KHBpblRpbWVyUmVmLmN1cnJlbnQpO1xyXG4gICAgcGluVGltZXJSZWYuY3VycmVudCA9IHNldFRpbWVvdXQoaGlkZVBpbkNhcmQsIDMyMCk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgZ2V0UGluQ2FyZCA9IChjZW50ZXIpID0+IHtcclxuICAgIGlmICghcGluQ2FyZHNSZWYuY3VycmVudC5oYXMoY2VudGVyLmlkKSkge1xyXG4gICAgICBjb25zdCBjYXJkID0gYnVpbGRQaW5DYXJkKGNlbnRlciwgKGMpID0+IHZjSGFuZGxlclJlZi5jdXJyZW50ICYmIHZjSGFuZGxlclJlZi5jdXJyZW50KGMpKTtcclxuICAgICAgLy8gS2VlcCB0aGUgY2FyZCBvcGVuIHdoaWxlIHRoZSBwb2ludGVyIGlzIG9uIGl0IChidXR0b25zIHN0YXkgY2xpY2thYmxlKS5cclxuICAgICAgY2FyZC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWVudGVyJywgKCkgPT4gY2xlYXJUaW1lb3V0KHBpblRpbWVyUmVmLmN1cnJlbnQpKTtcclxuICAgICAgY2FyZC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWxlYXZlJywgKCkgPT4gc2NoZWR1bGVQaW5DbG9zZSgpKTtcclxuICAgICAgcGluQ2FyZHNSZWYuY3VycmVudC5zZXQoY2VudGVyLmlkLCBjYXJkKTtcclxuICAgIH1cclxuICAgIHJldHVybiBwaW5DYXJkc1JlZi5jdXJyZW50LmdldChjZW50ZXIuaWQpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IG9wZW5QaW5DYXJkID0gKGNlbnRlciwgbWFya2VyKSA9PiB7XHJcbiAgICBjbGVhclRpbWVvdXQocGluVGltZXJSZWYuY3VycmVudCk7XHJcbiAgICBpZiAoIWdSZWYuY3VycmVudD8uaW5mbykgcmV0dXJuO1xyXG4gICAgZ1JlZi5jdXJyZW50LmluZm8uc2V0Q29udGVudChnZXRQaW5DYXJkKGNlbnRlcikpO1xyXG4gICAgZ1JlZi5jdXJyZW50LmluZm8ub3Blbih7IG1hcDogZ1JlZi5jdXJyZW50Lm1hcCwgYW5jaG9yOiBtYXJrZXIgfSk7XHJcbiAgfTtcclxuXHJcbiAgLyoqIE9wZW5zIGEgbGl2ZSAoZW5jcnlwdGVkLCBKaXRzaSkgdmlkZW8gcm9vbSBmb3IgdGhpcyBjZW50ZXIncyBoZWFkLiAqL1xyXG4gIGNvbnN0IHN0YXJ0VmlkZW9DYWxsID0gYXN5bmMgKGNlbnRlcikgPT4ge1xyXG4gICAgaWYgKCFjZW50ZXIpIHJldHVybjtcclxuICAgIHNldFZjQnVzeShjZW50ZXIuaWQpO1xyXG4gICAgY29uc3QgY2FyZEJ1dHRvbiA9IHBpbkNhcmRzUmVmLmN1cnJlbnQuZ2V0KGNlbnRlci5pZCk/LnF1ZXJ5U2VsZWN0b3IoJy5zZC12YycpO1xyXG4gICAgaWYgKGNhcmRCdXR0b24pIHtcclxuICAgICAgY2FyZEJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XHJcbiAgICAgIGNhcmRCdXR0b24udGV4dENvbnRlbnQgPSAn8J+OpSBDb25uZWN0aW5n4oCmJztcclxuICAgIH1cclxuICAgIGNvbnN0IHdpbiA9IHdpbmRvdy5vcGVuKCcnLCAnX2JsYW5rJyk7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCB7IGRhdGE6IGJvZHkgfSA9IGF3YWl0IHZjQVBJLmNyZWF0ZSh7IHByb2plY3RfaWQ6IGNlbnRlci5pZCwgbW9kZTogJ2RpcmVjdCcgfSk7XHJcbiAgICAgIGNvbnN0IHNlc3Npb24gPSBib2R5Py5zZXNzaW9uIHx8IHt9O1xyXG4gICAgICBpZiAod2luICYmIHNlc3Npb24uam9pbl91cmwpIHtcclxuICAgICAgICB3aW4ubG9jYXRpb24uaHJlZiA9IHNlc3Npb24uam9pbl91cmw7XHJcbiAgICAgICAgc2V0VmNOb3RpY2UoXHJcbiAgICAgICAgICBg8J+OpSBWQyByb29tICR7c2Vzc2lvbi5yb29tX2lkfSBvcGVuZWQgd2l0aCAke2NlbnRlci5oZWFkPy5uYW1lIHx8IGNlbnRlci5uYW1lfWAgK1xyXG4gICAgICAgICAgICAoc2Vzc2lvbi5vZmZpY2lhbF9uYW1lID8gYCDCtyBvZmZpY2lhbCBvbiB0aGUgbGluZTogJHtzZXNzaW9uLm9mZmljaWFsX25hbWV9YCA6ICcnKSArICcuJ1xyXG4gICAgICAgICk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaWYgKHdpbikgd2luLmNsb3NlKCk7XHJcbiAgICAgICAgc2V0VmNOb3RpY2UoYEEgcm9vbSB3YXMgY3JlYXRlZCBidXQgdGhlIHBvcHVwIHdhcyBibG9ja2VkIC0gb3BlbiBpdCBoZXJlOiAke3Nlc3Npb24uam9pbl91cmwgfHwgJyd9YCk7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBpZiAod2luKSB3aW4uY2xvc2UoKTtcclxuICAgICAgc2V0VmNOb3RpY2UoZXJyLnJlc3BvbnNlPy5kYXRhPy5tZXNzYWdlIHx8ICdDb3VsZCBub3Qgb3BlbiBhIHZpZGVvLWNhbGwgc2Vzc2lvbi4nKTtcclxuICAgIH0gZmluYWxseSB7XHJcbiAgICAgIGlmIChjYXJkQnV0dG9uKSB7XHJcbiAgICAgICAgY2FyZEJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgIGNhcmRCdXR0b24udGV4dENvbnRlbnQgPSAn8J+OpSBWaWRlbyBjYWxsJztcclxuICAgICAgfVxyXG4gICAgICBzZXRWY0J1c3kobnVsbCk7XHJcbiAgICB9XHJcbiAgfTtcclxuICB2Y0hhbmRsZXJSZWYuY3VycmVudCA9IHN0YXJ0VmlkZW9DYWxsO1xyXG5cclxuICAvLyBDYXJkcyBlbWJlZCBuYW1lL2hlYWQsIHNvIHJlYnVpbGQgdGhlbSB3aGVuZXZlciBmcmVzaCBkYXRhIGFycml2ZXMuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIHBpbkNhcmRzUmVmLmN1cnJlbnQuY2xlYXIoKTtcclxuICB9LCBbZGF0YV0pO1xyXG5cclxuICBjb25zdCBsb2FkID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgc2V0TG9hZGluZyh0cnVlKTtcclxuICAgIHNldEVycm9yKG51bGwpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmVzID0gYXdhaXQgZ2lzQVBJLmNlbnRlcnMoKTtcclxuICAgICAgc2V0RGF0YShyZXMuZGF0YSk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignR0lTIGxvYWQgZXJyb3I6JywgZXJyKTtcclxuICAgICAgc2V0RXJyb3IoJ0NvdWxkIG5vdCBsb2FkIHRoZSBjb21wbGlhbmNlIEdJUyBmZWVkLiBJcyB0aGUgQVBJIHJ1bm5pbmcgb24gcG9ydCA1MDAwPycpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGxvYWQoKTtcclxuICB9LCBbXSk7XHJcblxyXG4gIC8vIFBpY2sgdGhlIHJlYWwtbWFwIGVuZ2luZTogR29vZ2xlIE1hcHMgd2l0aCB0aGUgYmFja2VuZCBrZXksIE9TTSBmYWxsYmFjay5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKCFkYXRhKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgbGV0IGNhbmNlbGxlZCA9IGZhbHNlO1xyXG4gICAgbG9hZEdvb2dsZU1hcHMoZGF0YS5tYXA/LmFwaV9rZXkpXHJcbiAgICAgIC50aGVuKCgpID0+ICFjYW5jZWxsZWQgJiYgc2V0RW5naW5lKCdnb29nbGUnKSlcclxuICAgICAgLmNhdGNoKChlcnIpID0+IHtcclxuICAgICAgICBpZiAoY2FuY2VsbGVkKSByZXR1cm47XHJcbiAgICAgICAgc2V0RW5naW5lKCdsZWFmbGV0Jyk7XHJcbiAgICAgICAgc2V0RW5naW5lTm90ZShcclxuICAgICAgICAgIGVyci5tZXNzYWdlID09PSAnbm8ta2V5J1xyXG4gICAgICAgICAgICA/ICdObyBHb29nbGUgTWFwcyBBUEkga2V5IGNvbmZpZ3VyZWQgb24gdGhlIGJhY2tlbmQg4oCUIHVzaW5nIE9wZW5TdHJlZXRNYXAgdGlsZXMuJ1xyXG4gICAgICAgICAgICA6ICdHb29nbGUgTWFwcyBjb3VsZCBub3QgaW5pdGlhbGlzZSB3aXRoIHRoaXMga2V5IG9uIHRoaXMgbWFjaGluZSDigJQgdXNpbmcgT3BlblN0cmVldE1hcCB0aWxlcy4nXHJcbiAgICAgICAgKTtcclxuICAgICAgfSk7XHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICBjYW5jZWxsZWQgPSB0cnVlO1xyXG4gICAgfTtcclxuICB9LCBbZGF0YV0pO1xyXG5cclxuICAvLyBHb29nbGUgbWFwIGluc3RhbmNlLlxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBpZiAoZW5naW5lICE9PSAnZ29vZ2xlJyB8fCAhZGF0YSB8fCAhbWFwUmVmLmN1cnJlbnQgfHwgZ1JlZi5jdXJyZW50KSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgY29uc3QgZyA9IHdpbmRvdy5nb29nbGUubWFwcztcclxuICAgIGNvbnN0IG1hcCA9IG5ldyBnLk1hcChtYXBSZWYuY3VycmVudCwge1xyXG4gICAgICBjZW50ZXI6IElORElBX0NFTlRFUixcclxuICAgICAgem9vbTogNSxcclxuICAgICAgbWFwVHlwZUNvbnRyb2w6IHRydWUsXHJcbiAgICAgIHN0cmVldFZpZXdDb250cm9sOiBmYWxzZSxcclxuICAgICAgZnVsbHNjcmVlbkNvbnRyb2w6IHRydWUsXHJcbiAgICAgIGNsaWNrYWJsZUljb25zOiBmYWxzZSxcclxuICAgIH0pO1xyXG4gICAgZ1JlZi5jdXJyZW50ID0geyBtYXAsIG1hcmtlcnM6IFtdLCBpbmZvOiBuZXcgZy5JbmZvV2luZG93KHsgZGlzYWJsZUF1dG9QYW46IHRydWUgfSkgfTtcclxuICAgIC8vIEEgY2xpY2sgYW55d2hlcmUgb24gdGhlIG1hcCBkaXNtaXNzZXMgYSBsaW5nZXJpbmcgaG92ZXIgY2FyZC5cclxuICAgIG1hcC5hZGRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XHJcbiAgICAgIGlmIChnUmVmLmN1cnJlbnQ/LmluZm8pIGdSZWYuY3VycmVudC5pbmZvLmNsb3NlKCk7XHJcbiAgICB9KTtcclxuICAgIC8vIElmIEdvb2dsZSByZWplY3RzIHRoZSBrZXkgYWZ0ZXIgKGxhenkpIGF1dGgsIGRlZ3JhZGUgdG8gT1NNIGluc3RlYWQgb2YgYSBncmV5IG1hcC5cclxuICAgIHdpbmRvdy5nbV9hdXRoRmFpbHVyZSA9ICgpID0+IHtcclxuICAgICAgc2V0RW5naW5lKCdsZWFmbGV0Jyk7XHJcbiAgICAgIHNldEVuZ2luZU5vdGUoJ0dvb2dsZSBNYXBzIHJlamVjdGVkIHRoaXMga2V5IChhdXRoIGZhaWx1cmUpIOKAlCBzd2l0Y2hlZCB0byBPcGVuU3RyZWV0TWFwIHRpbGVzLicpO1xyXG4gICAgfTtcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIChnUmVmLmN1cnJlbnQ/Lm1hcmtlcnMgfHwgW10pLmZvckVhY2goKG0pID0+IG0uc2V0TWFwKG51bGwpKTtcclxuICAgICAgZ1JlZi5jdXJyZW50ID0gbnVsbDtcclxuICAgIH07XHJcbiAgfSwgW2VuZ2luZSwgZGF0YV0pO1xyXG5cclxuICAvLyBMZWFmbGV0IGZhbGxiYWNrIGluc3RhbmNlIChsb2FkZWQgbGF6aWx5IHNvIGl0IG5ldmVyIHdlaWdocyBvbiB0aGUgYnVuZGxlKS5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKGVuZ2luZSAhPT0gJ2xlYWZsZXQnIHx8ICFkYXRhIHx8ICFtYXBSZWYuY3VycmVudCB8fCBsUmVmLmN1cnJlbnQpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBsZXQgZGlzcG9zZWQgPSBmYWxzZTtcclxuICAgIChhc3luYyAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IEwgPSAoYXdhaXQgaW1wb3J0KCdsZWFmbGV0JykpLmRlZmF1bHQ7XHJcbiAgICAgIGF3YWl0IGltcG9ydCgnbGVhZmxldC9kaXN0L2xlYWZsZXQuY3NzJyk7XHJcbiAgICAgIGlmIChkaXNwb3NlZCB8fCAhbWFwUmVmLmN1cnJlbnQpIHJldHVybjtcclxuICAgICAgbWFwUmVmLmN1cnJlbnQuaW5uZXJIVE1MID0gJyc7XHJcbiAgICAgIGNvbnN0IG1hcCA9IEwubWFwKG1hcFJlZi5jdXJyZW50KS5zZXRWaWV3KFtJTkRJQV9DRU5URVIubGF0LCBJTkRJQV9DRU5URVIubG5nXSwgNSk7XHJcbiAgICAgIEwudGlsZUxheWVyKCdodHRwczovL3tzfS50aWxlLm9wZW5zdHJlZXRtYXAub3JnL3t6fS97eH0ve3l9LnBuZycsIHtcclxuICAgICAgICBtYXhab29tOiAxOSxcclxuICAgICAgICBhdHRyaWJ1dGlvbjogJyZjb3B5OyBPcGVuU3RyZWV0TWFwIGNvbnRyaWJ1dG9ycycsXHJcbiAgICAgIH0pLmFkZFRvKG1hcCk7XHJcbiAgICAgIGxSZWYuY3VycmVudCA9IHsgbWFwLCBsYXllcjogTC5sYXllckdyb3VwKCkuYWRkVG8obWFwKSwgTCB9O1xyXG4gICAgICBzZXRMZWFmbGV0UmVhZHkodHJ1ZSk7XHJcbiAgICB9KSgpO1xyXG4gICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgZGlzcG9zZWQgPSB0cnVlO1xyXG4gICAgICBpZiAobFJlZi5jdXJyZW50Py5tYXApIGxSZWYuY3VycmVudC5tYXAucmVtb3ZlKCk7XHJcbiAgICAgIGxSZWYuY3VycmVudCA9IG51bGw7XHJcbiAgICAgIHNldExlYWZsZXRSZWFkeShmYWxzZSk7XHJcbiAgICB9O1xyXG4gIH0sIFtlbmdpbmUsIGRhdGFdKTtcclxuXHJcbiAgLy8gS2VlcCB0aGUgbWFya2VycyBpbiBzeW5jIHdpdGggdGhlIGZpbHRlciBhbmQgdGhlIHNlbGVjdGVkIGNlbnRlci5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKCFhY3RpdmVDZW50ZXIpIHJldHVybjtcclxuICAgIGlmIChlbmdpbmUgPT09ICdnb29nbGUnICYmIGdSZWYuY3VycmVudCkge1xyXG4gICAgICBjb25zdCBnID0gd2luZG93Lmdvb2dsZS5tYXBzO1xyXG4gICAgICBjb25zdCB7IG1hcCwgbWFya2VycyB9ID0gZ1JlZi5jdXJyZW50O1xyXG4gICAgICBtYXJrZXJzLmZvckVhY2goKG0pID0+IG0uc2V0TWFwKG51bGwpKTtcclxuICAgICAgZ1JlZi5jdXJyZW50Lm1hcmtlcnMgPSBmaWx0ZXJlZENlbnRlcnMubWFwKChjZW50ZXIpID0+IHtcclxuICAgICAgICBjb25zdCBzZWxlY3RlZCA9IGNlbnRlci5pZCA9PT0gYWN0aXZlQ2VudGVyLmlkO1xyXG4gICAgICAgIGNvbnN0IG1hcmtlciA9IG5ldyBnLk1hcmtlcih7XHJcbiAgICAgICAgICBwb3NpdGlvbjoge1xyXG4gICAgICAgICAgICBsYXQ6IGNlbnRlci5nZW9fY29vcmRzPy5sYXQgfHwgSU5ESUFfQ0VOVEVSLmxhdCxcclxuICAgICAgICAgICAgbG5nOiBjZW50ZXIuZ2VvX2Nvb3Jkcz8ubG5nIHx8IElORElBX0NFTlRFUi5sbmcsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgbWFwLFxyXG4gICAgICAgICAgdGl0bGU6IGNlbnRlci5uYW1lLFxyXG4gICAgICAgICAgaWNvbjoge1xyXG4gICAgICAgICAgICBwYXRoOiBnLlN5bWJvbFBhdGguQ0lSQ0xFLFxyXG4gICAgICAgICAgICBzY2FsZTogc2VsZWN0ZWQgPyAxMSA6IDgsXHJcbiAgICAgICAgICAgIGZpbGxDb2xvcjogY2VudGVyQ29sb3IoY2VudGVyKSxcclxuICAgICAgICAgICAgZmlsbE9wYWNpdHk6IHNlbGVjdGVkID8gMSA6IDAuODUsXHJcbiAgICAgICAgICAgIHN0cm9rZUNvbG9yOiAnI2ZmZmZmZicsXHJcbiAgICAgICAgICAgIHN0cm9rZVdlaWdodDogMixcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgbWFya2VyLmFkZExpc3RlbmVyKCdjbGljaycsICgpID0+IHNldEFjdGl2ZUlkKGNlbnRlci5pZCkpO1xyXG4gICAgICAgIG1hcmtlci5hZGRMaXN0ZW5lcignbW91c2VvdmVyJywgKCkgPT4gb3BlblBpbkNhcmQoY2VudGVyLCBtYXJrZXIpKTtcclxuICAgICAgICBtYXJrZXIuYWRkTGlzdGVuZXIoJ21vdXNlb3V0JywgKCkgPT4gc2NoZWR1bGVQaW5DbG9zZSgpKTtcclxuICAgICAgICByZXR1cm4gbWFya2VyO1xyXG4gICAgICB9KTtcclxuICAgICAgaWYgKGFjdGl2ZUNlbnRlci5nZW9fY29vcmRzPy5sYXQpIHtcclxuICAgICAgICBtYXAucGFuVG8oeyBsYXQ6IGFjdGl2ZUNlbnRlci5nZW9fY29vcmRzLmxhdCwgbG5nOiBhY3RpdmVDZW50ZXIuZ2VvX2Nvb3Jkcy5sbmcgfSk7XHJcbiAgICAgICAgaWYgKChtYXAuZ2V0Wm9vbSgpIHx8IDUpIDwgNykgbWFwLnNldFpvb20oOSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGlmIChlbmdpbmUgPT09ICdsZWFmbGV0JyAmJiBsUmVmLmN1cnJlbnQgJiYgbGVhZmxldFJlYWR5KSB7XHJcbiAgICAgIGNvbnN0IHsgbWFwLCBsYXllciwgTCB9ID0gbFJlZi5jdXJyZW50O1xyXG4gICAgICBsYXllci5jbGVhckxheWVycygpO1xyXG4gICAgICBmaWx0ZXJlZENlbnRlcnMuZm9yRWFjaCgoY2VudGVyKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWQgPSBjZW50ZXIuaWQgPT09IGFjdGl2ZUNlbnRlci5pZDtcclxuICAgICAgICBMLmNpcmNsZU1hcmtlcihcclxuICAgICAgICAgIFtjZW50ZXIuZ2VvX2Nvb3Jkcz8ubGF0IHx8IElORElBX0NFTlRFUi5sYXQsIGNlbnRlci5nZW9fY29vcmRzPy5sbmcgfHwgSU5ESUFfQ0VOVEVSLmxuZ10sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHJhZGl1czogc2VsZWN0ZWQgPyAxMCA6IDcsXHJcbiAgICAgICAgICAgIGNvbG9yOiAnI2ZmZmZmZicsXHJcbiAgICAgICAgICAgIHdlaWdodDogMixcclxuICAgICAgICAgICAgZmlsbENvbG9yOiBjZW50ZXJDb2xvcihjZW50ZXIpLFxyXG4gICAgICAgICAgICBmaWxsT3BhY2l0eTogc2VsZWN0ZWQgPyAxIDogMC44NSxcclxuICAgICAgICAgIH1cclxuICAgICAgICApXHJcbiAgICAgICAgICAuYmluZFRvb2x0aXAoZ2V0UGluQ2FyZChjZW50ZXIpLCB7XHJcbiAgICAgICAgICAgIGRpcmVjdGlvbjogJ3RvcCcsXHJcbiAgICAgICAgICAgIG9mZnNldDogWzAsIC0xMF0sXHJcbiAgICAgICAgICAgIG9wYWNpdHk6IDEsXHJcbiAgICAgICAgICAgIGludGVyYWN0aXZlOiB0cnVlLFxyXG4gICAgICAgICAgICBjbGFzc05hbWU6ICdzZC1waW4tdGlwJyxcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgICAub24oJ2NsaWNrJywgKCkgPT4gc2V0QWN0aXZlSWQoY2VudGVyLmlkKSlcclxuICAgICAgICAgIC5hZGRUbyhsYXllcik7XHJcbiAgICAgIH0pO1xyXG4gICAgICBpZiAoYWN0aXZlQ2VudGVyLmdlb19jb29yZHM/LmxhdCkge1xyXG4gICAgICAgIG1hcC5zZXRWaWV3KFxyXG4gICAgICAgICAgW2FjdGl2ZUNlbnRlci5nZW9fY29vcmRzLmxhdCwgYWN0aXZlQ2VudGVyLmdlb19jb29yZHMubG5nXSxcclxuICAgICAgICAgIE1hdGgubWF4KG1hcC5nZXRab29tKCkgfHwgNSwgOClcclxuICAgICAgICApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSwgW2VuZ2luZSwgZmlsdGVyZWRDZW50ZXJzLCBhY3RpdmVDZW50ZXIsIGxlYWZsZXRSZWFkeV0pO1xyXG5cclxuICAvLyBMaXZlIHNuYXBzaG90czogcmVmcmVzaCB0aGUgZ3JvdW5kLUNDVFYgd2FsbCBldmVyeSA0IHMuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmICghb25saW5lQ2FtZXJhcykgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIGNvbnN0IGludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4gc2V0VGljaygodCkgPT4gdCArIDEpLCA0MDAwKTtcclxuICAgIHJldHVybiAoKSA9PiBjbGVhckludGVydmFsKGludGVydmFsKTtcclxuICB9LCBbYWN0aXZlQ2VudGVyPy5pZCwgb25saW5lQ2FtZXJhc10pO1xyXG5cclxuICBpZiAobG9hZGluZyAmJiAhZGF0YSkge1xyXG4gICAgcmV0dXJuIChcclxuICAgICAgPEJveCBzeD17eyBkaXNwbGF5OiAnZmxleCcsIGp1c3RpZnlDb250ZW50OiAnY2VudGVyJywgYWxpZ25JdGVtczogJ2NlbnRlcicsIG1pbkhlaWdodDogNDIwIH19PlxyXG4gICAgICAgIDxDaXJjdWxhclByb2dyZXNzIC8+XHJcbiAgICAgIDwvQm94PlxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHJldHVybiAoXHJcbiAgICA8Qm94PlxyXG4gICAgICA8c3R5bGU+e1BJTl9DQVJEX0NTU308L3N0eWxlPlxyXG4gICAgICA8Qm94IHN4PXt7IGRpc3BsYXk6ICdmbGV4JywganVzdGlmeUNvbnRlbnQ6ICdzcGFjZS1iZXR3ZWVuJywgYWxpZ25JdGVtczogJ2NlbnRlcicsIG1iOiAyLCBmbGV4V3JhcDogJ3dyYXAnLCBnYXA6IDIgfX0+XHJcbiAgICAgICAgPEJveD5cclxuICAgICAgICAgIDxUeXBvZ3JhcGh5IHZhcmlhbnQ9XCJoNFwiIHN4PXt7IGZvbnRXZWlnaHQ6IDcwMCwgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiAxIH19PlxyXG4gICAgICAgICAgICDwn5e677iPIFJlYWwtVGltZSBDb21wbGlhbmNlIEdJUyBNYXBcclxuICAgICAgICAgIDwvVHlwb2dyYXBoeT5cclxuICAgICAgICAgIDxUeXBvZ3JhcGh5IHZhcmlhbnQ9XCJib2R5MlwiIGNvbG9yPVwidGV4dC5zZWNvbmRhcnlcIj5cclxuICAgICAgICAgICAgRG9TSkUgTmF0aW9uYWwgTW9uaXRvcmluZyDCtyByZWFsIG1hcCBvZiBtb25pdG9yZWQgY2VudGVycyDCtyBjbGljayBhIGNlbnRlciBmb3IgaXRzIGluLWNoYXJnZSBhbmQgZ3JvdW5kLWxldmVsIENDVFZcclxuICAgICAgICAgIDwvVHlwb2dyYXBoeT5cclxuICAgICAgICA8L0JveD5cclxuICAgICAgICA8U3RhY2sgZGlyZWN0aW9uPVwicm93XCIgc3BhY2luZz17MX0gYWxpZ25JdGVtcz1cImNlbnRlclwiPlxyXG4gICAgICAgICAgPENoaXBcclxuICAgICAgICAgICAgc2l6ZT1cInNtYWxsXCJcclxuICAgICAgICAgICAgaWNvbj17PFB1YmxpY0ljb24gLz59XHJcbiAgICAgICAgICAgIGxhYmVsPXtcclxuICAgICAgICAgICAgICBlbmdpbmUgPT09ICdnb29nbGUnXHJcbiAgICAgICAgICAgICAgICA/ICdHb29nbGUgTWFwcyDCtyBsaXZlIGtleSdcclxuICAgICAgICAgICAgICAgIDogZW5naW5lID09PSAnbGVhZmxldCdcclxuICAgICAgICAgICAgICAgICAgPyAnT3BlblN0cmVldE1hcCBmYWxsYmFjaydcclxuICAgICAgICAgICAgICAgICAgOiAnTG9hZGluZyBtYXDigKYnXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29sb3I9e2VuZ2luZSA9PT0gJ2dvb2dsZScgPyAnc3VjY2VzcycgOiAnZGVmYXVsdCd9XHJcbiAgICAgICAgICAgIHZhcmlhbnQ9XCJvdXRsaW5lZFwiXHJcbiAgICAgICAgICAvPlxyXG4gICAgICAgICAgPEJ1dHRvbiB2YXJpYW50PVwib3V0bGluZWRcIiBzaXplPVwic21hbGxcIiBzdGFydEljb249ezxSZWZyZXNoSWNvbiAvPn0gb25DbGljaz17bG9hZH0+XHJcbiAgICAgICAgICAgIFJlZnJlc2ggRmVlZHNcclxuICAgICAgICAgIDwvQnV0dG9uPlxyXG4gICAgICAgIDwvU3RhY2s+XHJcbiAgICAgIDwvQm94PlxyXG5cclxuICAgICAge2Vycm9yICYmIChcclxuICAgICAgICA8QWxlcnRcclxuICAgICAgICAgIHNldmVyaXR5PVwiZXJyb3JcIlxyXG4gICAgICAgICAgc3g9e3sgbWI6IDIgfX1cclxuICAgICAgICAgIGFjdGlvbj17PEJ1dHRvbiBjb2xvcj1cImluaGVyaXRcIiBzaXplPVwic21hbGxcIiBvbkNsaWNrPXtsb2FkfT5SZXRyeTwvQnV0dG9uPn1cclxuICAgICAgICA+XHJcbiAgICAgICAgICB7ZXJyb3J9XHJcbiAgICAgICAgPC9BbGVydD5cclxuICAgICAgKX1cclxuICAgICAge2VuZ2luZU5vdGUgJiYgPEFsZXJ0IHNldmVyaXR5PVwiaW5mb1wiIHN4PXt7IG1iOiAyIH19PntlbmdpbmVOb3RlfTwvQWxlcnQ+fVxyXG5cclxuICAgICAgPFBhcGVyIHN4PXt7IHA6IDIsIG1iOiAzLCBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBqdXN0aWZ5Q29udGVudDogJ3NwYWNlLWJldHdlZW4nLCBmbGV4V3JhcDogJ3dyYXAnLCBnYXA6IDIgfX0+XHJcbiAgICAgICAgPEJveCBzeD17eyBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBnYXA6IDEsIGZsZXhXcmFwOiAnd3JhcCcgfX0+XHJcbiAgICAgICAgICA8VHlwb2dyYXBoeSB2YXJpYW50PVwic3VidGl0bGUyXCIgc3g9e3sgbXI6IDEgfX0+U2NoZW1lIEZpbHRlcjo8L1R5cG9ncmFwaHk+XHJcbiAgICAgICAgICB7WydBTEwnLCAnQVZZQVknLCAnTkFQRERSJywgJ1NJUERBJ10ubWFwKChzKSA9PiAoXHJcbiAgICAgICAgICAgIDxDaGlwXHJcbiAgICAgICAgICAgICAga2V5PXtzfVxyXG4gICAgICAgICAgICAgIGxhYmVsPXtzID09PSAnQUxMJyA/IGBBbGwgRmFjaWxpdGllcyAoJHtjZW50ZXJzLmxlbmd0aH0pYCA6IFNDSEVNRV9CQURHRVNbc10/LmxhYmVsIHx8IHN9XHJcbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRTY2hlbWUocyk7XHJcbiAgICAgICAgICAgICAgICBzZXRBY3RpdmVJZChudWxsKTtcclxuICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgIGNvbG9yPXtzZWxlY3RlZFNjaGVtZSA9PT0gcyA/ICdwcmltYXJ5JyA6ICdkZWZhdWx0J31cclxuICAgICAgICAgICAgICB2YXJpYW50PXtzZWxlY3RlZFNjaGVtZSA9PT0gcyA/ICdmaWxsZWQnIDogJ291dGxpbmVkJ31cclxuICAgICAgICAgICAgICBzeD17eyBmb250V2VpZ2h0OiA2MDAsIGN1cnNvcjogJ3BvaW50ZXInIH19XHJcbiAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICApKX1cclxuICAgICAgICA8L0JveD5cclxuICAgICAgICA8Qm94IHN4PXt7IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAyLCBmb250U2l6ZTogMTMsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBmbGV4V3JhcDogJ3dyYXAnIH19PlxyXG4gICAgICAgICAgPEJveCBzeD17eyBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBnYXA6IDAuNSB9fT5cclxuICAgICAgICAgICAgPEJveCBzeD17eyB3aWR0aDogMTIsIGhlaWdodDogMTIsIGJvcmRlclJhZGl1czogJzUwJScsIGJnY29sb3I6ICcjMTZhMzRhJyB9fSAvPlxyXG4gICAgICAgICAgICA8c3Bhbj5Db21wbGlhbnQ8L3NwYW4+XHJcbiAgICAgICAgICA8L0JveD5cclxuICAgICAgICAgIDxCb3ggc3g9e3sgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiAwLjUgfX0+XHJcbiAgICAgICAgICAgIDxCb3ggc3g9e3sgd2lkdGg6IDEyLCBoZWlnaHQ6IDEyLCBib3JkZXJSYWRpdXM6ICc1MCUnLCBiZ2NvbG9yOiAnI2RjMjYyNicgfX0gLz5cclxuICAgICAgICAgICAgPHNwYW4+RmxhZ2dlZCAvIGF1ZGl0IHNwb3RsaWdodDwvc3Bhbj5cclxuICAgICAgICAgIDwvQm94PlxyXG4gICAgICAgICAgPEJveCBzeD17eyBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBnYXA6IDAuNSB9fT5cclxuICAgICAgICAgICAgPFZpZGVvY2FtSWNvbiBzeD17eyBmb250U2l6ZTogMTUsIGNvbG9yOiAnIzBlNzQ5MCcgfX0gLz5cclxuICAgICAgICAgICAgPHNwYW4+e2NlbnRlcnMucmVkdWNlKChzdW0sIGMpID0+IHN1bSArIGMuY2FtZXJhX2NvdW50LCAwKX0gZ3JvdW5kIGNhbWVyYXMgcmVnaXN0ZXJlZDwvc3Bhbj5cclxuICAgICAgICAgIDwvQm94PlxyXG4gICAgICAgIDwvQm94PlxyXG4gICAgICA8L1BhcGVyPlxyXG5cclxuICAgICAgPEdyaWQgY29udGFpbmVyIHNwYWNpbmc9ezN9PlxyXG4gICAgICAgIDxHcmlkIGl0ZW0geHM9ezEyfSBsZz17OH0+XHJcbiAgICAgICAgICA8UGFwZXIgc3g9e3sgcDogMC43NSwgcG9zaXRpb246ICdyZWxhdGl2ZScsIG92ZXJmbG93OiAnaGlkZGVuJyB9fT5cclxuICAgICAgICAgICAgPEJveCByZWY9e21hcFJlZn0gc3g9e3sgaGVpZ2h0OiA1NjAsIHdpZHRoOiAnMTAwJScsIGJvcmRlclJhZGl1czogMSwgYmdjb2xvcjogJyNlOGVlZjYnIH19IC8+XHJcbiAgICAgICAgICAgIHtlbmdpbmUgPT09ICdwZW5kaW5nJyAmJiAoXHJcbiAgICAgICAgICAgICAgPEJveFxyXG4gICAgICAgICAgICAgICAgc3g9e3tcclxuICAgICAgICAgICAgICAgICAgcG9zaXRpb246ICdhYnNvbHV0ZScsIGluc2V0OiAwLCBkaXNwbGF5OiAnZmxleCcsIGZsZXhEaXJlY3Rpb246ICdjb2x1bW4nLFxyXG4gICAgICAgICAgICAgICAgICBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBnYXA6IDEuNSwgYmdjb2xvcjogJ3JnYmEoMjU1LDI1NSwyNTUsMC42NSknLFxyXG4gICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICA8Q2lyY3VsYXJQcm9ncmVzcyBzaXplPXsyOH0gLz5cclxuICAgICAgICAgICAgICAgIDxUeXBvZ3JhcGh5IHZhcmlhbnQ9XCJjYXB0aW9uXCIgY29sb3I9XCJ0ZXh0LnNlY29uZGFyeVwiPkxvYWRpbmcgdGhlIGxpdmUgbWFw4oCmPC9UeXBvZ3JhcGh5PlxyXG4gICAgICAgICAgICAgIDwvQm94PlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgPC9QYXBlcj5cclxuICAgICAgICAgIDxCb3ggc3g9e3sgZGlzcGxheTogJ2ZsZXgnLCBnYXA6IDIuNSwgZmxleFdyYXA6ICd3cmFwJywgbXQ6IDEuNSwgcHg6IDAuNSwgZm9udFNpemU6IDEyLjUsIGNvbG9yOiAnIzQ3NTU2OScgfX0+XHJcbiAgICAgICAgICAgIHtPYmplY3QuZW50cmllcyhTQ0hFTUVfQ09MT1JTKS5tYXAoKFtzY2hlbWUsIGNvbG9yXSkgPT4gKFxyXG4gICAgICAgICAgICAgIDxCb3gga2V5PXtzY2hlbWV9IHN4PXt7IGRpc3BsYXk6ICdmbGV4JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIGdhcDogMC43IH19PlxyXG4gICAgICAgICAgICAgICAgPEJveCBzeD17eyB3aWR0aDogMTEsIGhlaWdodDogMTEsIGJvcmRlclJhZGl1czogJzUwJScsIGJnY29sb3I6IGNvbG9yIH19IC8+XHJcbiAgICAgICAgICAgICAgICA8c3Bhbj57U0NIRU1FX0JBREdFU1tzY2hlbWVdPy5sYWJlbCB8fCBzY2hlbWV9PC9zcGFuPlxyXG4gICAgICAgICAgICAgIDwvQm94PlxyXG4gICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgPEJveCBzeD17eyBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBnYXA6IDAuNyB9fT5cclxuICAgICAgICAgICAgICA8TG9jYXRpb25JY29uIHN4PXt7IGZvbnRTaXplOiAxNCB9fSAvPlxyXG4gICAgICAgICAgICAgIDxzcGFuPkhvdmVyIGEgcGluIGZvciB0aGUgZGVwYXJ0bWVudCBoZWFkICsgY2FsbCAvIHZpZGVvLWNhbGwgYWN0aW9ucyDCtyBjbGljayBhIHBpbiBmb3IgdGhlIGZ1bGwgZHJpbGwtZG93bi48L3NwYW4+XHJcbiAgICAgICAgICAgIDwvQm94PlxyXG4gICAgICAgICAgPC9Cb3g+XHJcbiAgICAgICAgPC9HcmlkPlxyXG4gICAgICAgIDxHcmlkIGl0ZW0geHM9ezEyfSBsZz17NH0+XHJcbiAgICAgICAgICA8Qm94IHN4PXt7IGRpc3BsYXk6ICdmbGV4JywgZmxleERpcmVjdGlvbjogJ2NvbHVtbicsIGdhcDogMiB9fT5cclxuICAgICAgICAgICAgPFBhcGVyIHN4PXt7IHA6IDEuMjUsIG92ZXJmbG93OiAnYXV0bycsIG1heEhlaWdodDogMjEwIH19PlxyXG4gICAgICAgICAgICAgIDxUeXBvZ3JhcGh5IHZhcmlhbnQ9XCJzdWJ0aXRsZTJcIiBzeD17eyBweDogMC41LCBtYjogMSwgY29sb3I6ICcjMzM0MTU1JyB9fT5cclxuICAgICAgICAgICAgICAgIE1vbml0b3JlZCBGYWNpbGl0aWVzICh7ZmlsdGVyZWRDZW50ZXJzLmxlbmd0aH0pXHJcbiAgICAgICAgICAgICAgPC9UeXBvZ3JhcGh5PlxyXG4gICAgICAgICAgICAgIDxTdGFjayBzcGFjaW5nPXswLjV9PlxyXG4gICAgICAgICAgICAgICAge2ZpbHRlcmVkQ2VudGVycy5tYXAoKGMpID0+IHtcclxuICAgICAgICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWQgPSBhY3RpdmVDZW50ZXI/LmlkID09PSBjLmlkO1xyXG4gICAgICAgICAgICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICAgICAgICAgIDxCb3hcclxuICAgICAgICAgICAgICAgICAgICAgIGtleT17Yy5pZH1cclxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldEFjdGl2ZUlkKGMuaWQpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgc3g9e3tcclxuICAgICAgICAgICAgICAgICAgICAgICAgY3Vyc29yOiAncG9pbnRlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHB4OiAxLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBweTogMC43NSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiAxLjI1LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkaXNwbGF5OiAnZmxleCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFsaWduSXRlbXM6ICdjZW50ZXInLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBnYXA6IDEsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJnY29sb3I6IHNlbGVjdGVkID8gJyNlZmY2ZmYnIDogJ3RyYW5zcGFyZW50JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYm9yZGVyOiAnMXB4IHNvbGlkJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYm9yZGVyQ29sb3I6IHNlbGVjdGVkID8gJyNiZmRiZmUnIDogJ3RyYW5zcGFyZW50JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJyY6aG92ZXInOiB7IGJnY29sb3I6ICcjZjhmYWZjJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8Qm94IHN4PXt7IHdpZHRoOiAxMCwgaGVpZ2h0OiAxMCwgYm9yZGVyUmFkaXVzOiAnNTAlJywgYmdjb2xvcjogY2VudGVyQ29sb3IoYyksIGZsZXhTaHJpbms6IDAgfX0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgIDxUeXBvZ3JhcGh5IG5vV3JhcCBzeD17eyBmb250U2l6ZTogMTIuNSwgZm9udFdlaWdodDogc2VsZWN0ZWQgPyA3MDAgOiA1MDAsIGZsZXhHcm93OiAxIH19IHRpdGxlPXtjLm5hbWV9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7Yy5uYW1lfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9UeXBvZ3JhcGh5PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPENoaXBcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cInNtYWxsXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw9e2Ake2MuY2FtZXJhc19vbmxpbmV9LyR7Yy5jYW1lcmFfY291bnR9YH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWNvbj17PFZpZGVvY2FtSWNvbiBzeD17eyBmb250U2l6ZTogMTMgfX0gLz59XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN4PXt7IGhlaWdodDogMjAsIGZvbnRTaXplOiAxMC41LCBmbGV4U2hyaW5rOiAwIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJvdXRsaW5lZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yPXtjLmNhbWVyYXNfb25saW5lID8gJ3N1Y2Nlc3MnIDogJ2RlZmF1bHQnfVxyXG4gICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICA8L0JveD5cclxuICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIH0pfVxyXG4gICAgICAgICAgICAgIDwvU3RhY2s+XHJcbiAgICAgICAgICAgIDwvUGFwZXI+XHJcblxyXG4gICAgICAgICAgICB7YWN0aXZlQ2VudGVyID8gKFxyXG4gICAgICAgICAgICAgIDxQYXBlciBzeD17eyBwOiAyLjI1LCBvdmVyZmxvdzogJ2F1dG8nIH19PlxyXG4gICAgICAgICAgICAgICAgPEJveCBzeD17eyBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBnYXA6IDEsIG1iOiAxLCBmbGV4V3JhcDogJ3dyYXAnIH19PlxyXG4gICAgICAgICAgICAgICAgICA8Q2hpcFxyXG4gICAgICAgICAgICAgICAgICAgIHNpemU9XCJzbWFsbFwiXHJcbiAgICAgICAgICAgICAgICAgICAgbGFiZWw9e1NDSEVNRV9CQURHRVNbYWN0aXZlQ2VudGVyLnNjaGVtZV0/LmxhYmVsIHx8IGFjdGl2ZUNlbnRlci5zY2hlbWV9XHJcbiAgICAgICAgICAgICAgICAgICAgc3g9e3tcclxuICAgICAgICAgICAgICAgICAgICAgIGJnY29sb3I6IFNDSEVNRV9CQURHRVNbYWN0aXZlQ2VudGVyLnNjaGVtZV0/LmJnIHx8ICcjZjFmNWY5JyxcclxuICAgICAgICAgICAgICAgICAgICAgIGNvbG9yOiBTQ0hFTUVfQkFER0VTW2FjdGl2ZUNlbnRlci5zY2hlbWVdPy5jb2xvciB8fCAnIzQ3NTU2OScsXHJcbiAgICAgICAgICAgICAgICAgICAgICBmb250V2VpZ2h0OiA3MDAsXHJcbiAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgPENoaXAgc2l6ZT1cInNtYWxsXCIgbGFiZWw9e2FjdGl2ZUNlbnRlci5zdGF0dXN9IGNvbG9yPXtzdGF0dXNDaGlwQ29sb3IoYWN0aXZlQ2VudGVyLnN0YXR1cyl9IC8+XHJcbiAgICAgICAgICAgICAgICA8L0JveD5cclxuXHJcbiAgICAgICAgICAgICAgICA8VHlwb2dyYXBoeSB2YXJpYW50PVwiaDZcIiBzeD17eyBmb250V2VpZ2h0OiA3MDAsIGxpbmVIZWlnaHQ6IDEuMyB9fT5cclxuICAgICAgICAgICAgICAgICAge2FjdGl2ZUNlbnRlci5uYW1lfVxyXG4gICAgICAgICAgICAgICAgPC9UeXBvZ3JhcGh5PlxyXG4gICAgICAgICAgICAgICAgPFR5cG9ncmFwaHkgdmFyaWFudD1cImNhcHRpb25cIiBjb2xvcj1cInRleHQuc2Vjb25kYXJ5XCIgc3g9e3sgZGlzcGxheTogJ2Jsb2NrJywgbXQ6IDAuNSB9fT5cclxuICAgICAgICAgICAgICAgICAg8J+TjSB7YWN0aXZlQ2VudGVyLmxvY2F0aW9ufVxyXG4gICAgICAgICAgICAgICAgPC9UeXBvZ3JhcGh5PlxyXG5cclxuICAgICAgICAgICAgICAgIDxEaXZpZGVyIHN4PXt7IG15OiAxLjUgfX0gLz5cclxuXHJcbiAgICAgICAgICAgICAgICB7YWN0aXZlQ2VudGVyLnN0YXR1cyA9PT0gJ2ZsYWdnZWQnICYmIChcclxuICAgICAgICAgICAgICAgICAgPEFsZXJ0IHNldmVyaXR5PVwiZXJyb3JcIiBzeD17eyBtYjogMiB9fT5cclxuICAgICAgICAgICAgICAgICAgICA8c3Ryb25nPkRvU0pFIEF1ZGl0IFNwb3RsaWdodDo8L3N0cm9uZz4gdGhpcyBjZW50ZXIgaXMgZmxhZ2dlZCDigJQgQ0NUViB0YW1wZXIgb3IgaGVhZGNvdW50XHJcbiAgICAgICAgICAgICAgICAgICAgYW5vbWFsaWVzIHdlcmUgZGV0ZWN0ZWQuIFBoeXNpY2FsbHkgdmVyaWZ5IGJlZm9yZSByZWxlYXNpbmcgZnVydGhlciBncmFudHMuXHJcbiAgICAgICAgICAgICAgICAgIDwvQWxlcnQ+XHJcbiAgICAgICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAgICAgIDxCb3ggc3g9e3sgYmdjb2xvcjogJyNmMGY5ZmYnLCBib3JkZXI6ICcxcHggc29saWQgI2JhZTZmZCcsIGJvcmRlclJhZGl1czogMiwgcDogMS43NSwgbWI6IDIgfX0+XHJcbiAgICAgICAgICAgICAgICAgIDxCb3ggc3g9e3sgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiAwLjc1LCBtYjogMSB9fT5cclxuICAgICAgICAgICAgICAgICAgICA8UGVyc29uSWNvbiBzeD17eyBmb250U2l6ZTogMTYsIGNvbG9yOiAnIzAzNjlhMScgfX0gLz5cclxuICAgICAgICAgICAgICAgICAgICA8VHlwb2dyYXBoeVxyXG4gICAgICAgICAgICAgICAgICAgICAgdmFyaWFudD1cImNhcHRpb25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgc3g9e3sgZm9udFdlaWdodDogODAwLCBsZXR0ZXJTcGFjaW5nOiAwLjYsIGNvbG9yOiAnIzAzNjlhMScsIHRleHRUcmFuc2Zvcm06ICd1cHBlcmNhc2UnIH19XHJcbiAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgQ2VudGVyIEhlYWQgLyBJbi1jaGFyZ2VcclxuICAgICAgICAgICAgICAgICAgICA8L1R5cG9ncmFwaHk+XHJcbiAgICAgICAgICAgICAgICAgIDwvQm94PlxyXG4gICAgICAgICAgICAgICAgICB7YWN0aXZlQ2VudGVyLmhlYWQgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgPD5cclxuICAgICAgICAgICAgICAgICAgICAgIDxUeXBvZ3JhcGh5IHN4PXt7IGZvbnRXZWlnaHQ6IDcwMCwgZm9udFNpemU6IDE1IH19PnthY3RpdmVDZW50ZXIuaGVhZC5uYW1lfTwvVHlwb2dyYXBoeT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxUeXBvZ3JhcGh5IHZhcmlhbnQ9XCJib2R5MlwiIGNvbG9yPVwidGV4dC5zZWNvbmRhcnlcIiBzeD17eyBtYjogMSB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAge2FjdGl2ZUNlbnRlci5oZWFkLmRlc2lnbmF0aW9ufVxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9UeXBvZ3JhcGh5PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPFN0YWNrIGRpcmVjdGlvbj1cInJvd1wiIHNwYWNpbmc9ezF9IGZsZXhXcmFwPVwid3JhcFwiIHVzZUZsZXhHYXA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHthY3RpdmVDZW50ZXIuaGVhZC5waG9uZSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPENoaXBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudD1cImFcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaHJlZj17YHRlbDoke2FjdGl2ZUNlbnRlci5oZWFkLnBob25lfWB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGlja2FibGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJzbWFsbFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpY29uPXs8UGhvbmVJY29uIHN4PXt7IGZvbnRTaXplOiAxNCB9fSAvPn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsPXthY3RpdmVDZW50ZXIuaGVhZC5waG9uZX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJvdXRsaW5lZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAge2FjdGl2ZUNlbnRlci5oZWFkLmVtYWlsICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8Q2hpcFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50PVwiYVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBocmVmPXtgbWFpbHRvOiR7YWN0aXZlQ2VudGVyLmhlYWQuZW1haWx9YH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsaWNrYWJsZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cInNtYWxsXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGljb249ezxFbWFpbEljb24gc3g9e3sgZm9udFNpemU6IDE0IH19IC8+fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw9e2FjdGl2ZUNlbnRlci5oZWFkLmVtYWlsfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudD1cIm91dGxpbmVkXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7YWN0aXZlQ2VudGVyLmhlYWQuc2luY2UgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxDaGlwIHNpemU9XCJzbWFsbFwiIGxhYmVsPXtgSW4tY2hhcmdlIHNpbmNlICR7YWN0aXZlQ2VudGVyLmhlYWQuc2luY2V9YH0gdmFyaWFudD1cIm91dGxpbmVkXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvU3RhY2s+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8U3RhY2sgZGlyZWN0aW9uPVwicm93XCIgc3BhY2luZz17MX0gc3g9e3sgbXQ6IDEuMjUgfX0gZmxleFdyYXA9XCJ3cmFwXCIgdXNlRmxleEdhcD5cclxuICAgICAgICAgICAgICAgICAgICAgICAge2FjdGl2ZUNlbnRlci5oZWFkLnBob25lICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8QnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQ9XCJhXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhyZWY9e2B0ZWw6JHthY3RpdmVDZW50ZXIuaGVhZC5waG9uZX1gfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cInNtYWxsXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJvdXRsaW5lZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydEljb249ezxQaG9uZUljb24gLz59XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2FsbCBoZWFkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9CdXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxCdXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBzaXplPVwic21hbGxcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJjb250YWluZWRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0SWNvbj17PFZpZGVvY2FtSWNvbiAvPn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzdGFydFZpZGVvQ2FsbChhY3RpdmVDZW50ZXIpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXt2Y0J1c3kgPT09IGFjdGl2ZUNlbnRlci5pZH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHt2Y0J1c3kgPT09IGFjdGl2ZUNlbnRlci5pZCA/ICdDb25uZWN0aW5n4oCmJyA6ICdWaWRlbyBjYWxsIGhlYWQnfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvU3RhY2s+XHJcbiAgICAgICAgICAgICAgICAgICAgPC8+XHJcbiAgICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPFR5cG9ncmFwaHkgdmFyaWFudD1cImJvZHkyXCIgY29sb3I9XCJ0ZXh0LnNlY29uZGFyeVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgSGVhZC1vZi1jZW50ZXIgZGV0YWlscyBhcmUgbm90IG9uIGZpbGUgZm9yIHRoaXMgZmFjaWxpdHkgeWV0LlxyXG4gICAgICAgICAgICAgICAgICAgIDwvVHlwb2dyYXBoeT5cclxuICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgIDwvQm94PlxyXG5cclxuICAgICAgICAgICAgICAgIDxCb3ggc3g9e3sgYmdjb2xvcjogJyNmOGZhZmMnLCBwOiAxLjUsIGJvcmRlclJhZGl1czogMS41LCBtYjogMiB9fT5cclxuICAgICAgICAgICAgICAgICAgPEdyaWQgY29udGFpbmVyIHNwYWNpbmc9ezF9IHN4PXt7IGZvbnRTaXplOiAxMiB9fT5cclxuICAgICAgICAgICAgICAgICAgICA8R3JpZCBpdGVtIHhzPXs2fT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGNvbG9yOiAnIzY0NzQ4YicgfX0+U2FuY3Rpb25lZCBCdWRnZXQ6PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiA3MDAgfX0+4oK5eyhhY3RpdmVDZW50ZXIuYnVkZ2V0IHx8IDApLnRvTG9jYWxlU3RyaW5nKCdlbi1JTicpfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvR3JpZD5cclxuICAgICAgICAgICAgICAgICAgICA8R3JpZCBpdGVtIHhzPXs2fT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGNvbG9yOiAnIzY0NzQ4YicgfX0+U2FuY3Rpb24gQ29kZTo8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDcwMCwgZm9udFNpemU6IDExIH19PnthY3RpdmVDZW50ZXIuc2FuY3Rpb25fY29kZSB8fCAn4oCUJ308L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L0dyaWQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPEdyaWQgaXRlbSB4cz17Nn0gc3g9e3sgbXQ6IDEgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17eyBjb2xvcjogJyM2NDc0OGInIH19PlNhbmN0aW9uZWQgQ2FwYWNpdHk6PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiA3MDAgfX0+e2FjdGl2ZUNlbnRlci5zYW5jdGlvbmVkX2NhcGFjaXR5ID8/ICfigJQnfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvR3JpZD5cclxuICAgICAgICAgICAgICAgICAgICA8R3JpZCBpdGVtIHhzPXs2fSBzeD17eyBtdDogMSB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGNvbG9yOiAnIzY0NzQ4YicgfX0+VmVyaWZpZWQgSGVhZGNvdW50Ojwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZm9udFdlaWdodDogNzAwIH19PnthY3RpdmVDZW50ZXIudmVyaWZpZWRfaGVhZGNvdW50ID8/ICfigJQnfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvR3JpZD5cclxuICAgICAgICAgICAgICAgICAgICA8R3JpZCBpdGVtIHhzPXs2fSBzeD17eyBtdDogMSB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGNvbG9yOiAnIzY0NzQ4YicgfX0+QUVCQVMgUHVuY2hlczo8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDcwMCB9fT57YWN0aXZlQ2VudGVyLmFlYmFzX3B1bmNoX2NvdW50ID8/ICfigJQnfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvR3JpZD5cclxuICAgICAgICAgICAgICAgICAgICA8R3JpZCBpdGVtIHhzPXs2fSBzeD17eyBtdDogMSB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IGNvbG9yOiAnIzY0NzQ4YicgfX0+RGlzY3JlcGFuY3kgzpQ6PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGZvbnRXZWlnaHQ6IDcwMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvcjogKGFjdGl2ZUNlbnRlci5kaXNjcmVwYW5jeV9kZWx0YSB8fCAwKSA+IDUgPyAnI2RjMjYyNicgOiAnIzA1OTY2OScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHthY3RpdmVDZW50ZXIuZGlzY3JlcGFuY3lfZGVsdGEgPz8gJ+KAlCd9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L0dyaWQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPEdyaWQgaXRlbSB4cz17Nn0gc3g9e3sgbXQ6IDEgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17eyBjb2xvcjogJyM2NDc0OGInIH19Pk5hdklDIENvb3JkaW5hdGVzOjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZm9udFdlaWdodDogNzAwIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7YWN0aXZlQ2VudGVyLmdlb19jb29yZHM/LmxhdCAhPSBudWxsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPyBgJHthY3RpdmVDZW50ZXIuZ2VvX2Nvb3Jkcy5sYXQudG9GaXhlZCg0KX3CsE4sICR7YWN0aXZlQ2VudGVyLmdlb19jb29yZHMubG5nLnRvRml4ZWQoNCl9wrBFYFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDogJ+KAlCd9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L0dyaWQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPEdyaWQgaXRlbSB4cz17Nn0gc3g9e3sgbXQ6IDEgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17eyBjb2xvcjogJyM2NDc0OGInIH19PkFJIEFub21hbHkgU3RhdHVzOjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBmb250V2VpZ2h0OiA3MDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6IGFjdGl2ZUNlbnRlci5zdGF0dXMgPT09ICdmbGFnZ2VkJyA/ICcjZWY0NDQ0JyA6ICcjMDU5NjY5JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAge2FjdGl2ZUNlbnRlci5zdGF0dXMgPT09ICdmbGFnZ2VkJyA/ICdISUdIIFJJU0sgREVURUNURUQnIDogJ05PTUlOQUwnfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9HcmlkPlxyXG4gICAgICAgICAgICAgICAgICA8L0dyaWQ+XHJcbiAgICAgICAgICAgICAgICA8L0JveD5cclxuXHJcbiAgICAgICAgICAgICAgICA8Qm94IHN4PXt7IGRpc3BsYXk6ICdmbGV4JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIGp1c3RpZnlDb250ZW50OiAnc3BhY2UtYmV0d2VlbicsIG1iOiAxIH19PlxyXG4gICAgICAgICAgICAgICAgICA8Qm94IHN4PXt7IGRpc3BsYXk6ICdmbGV4JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIGdhcDogMC43NSB9fT5cclxuICAgICAgICAgICAgICAgICAgICA8VmlkZW9jYW1JY29uIHN4PXt7IGZvbnRTaXplOiAxNywgY29sb3I6ICcjMGU3NDkwJyB9fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgIDxUeXBvZ3JhcGh5IHZhcmlhbnQ9XCJzdWJ0aXRsZTJcIiBzeD17eyBmb250V2VpZ2h0OiA4MDAsIGNvbG9yOiAnIzBlNzQ5MCcsIGxldHRlclNwYWNpbmc6IDAuMyB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgIEdST1VORC1MRVZFTCBDQ1RWIMK3IExJVkVcclxuICAgICAgICAgICAgICAgICAgICA8L1R5cG9ncmFwaHk+XHJcbiAgICAgICAgICAgICAgICAgIDwvQm94PlxyXG4gICAgICAgICAgICAgICAgICA8Q2hpcFxyXG4gICAgICAgICAgICAgICAgICAgIHNpemU9XCJzbWFsbFwiXHJcbiAgICAgICAgICAgICAgICAgICAgY29sb3I9e29ubGluZUNhbWVyYXMgPyAnc3VjY2VzcycgOiAnZGVmYXVsdCd9XHJcbiAgICAgICAgICAgICAgICAgICAgbGFiZWw9e2Ake29ubGluZUNhbWVyYXN9LyR7YWN0aXZlQ2FtZXJhcy5sZW5ndGh9IG9ubGluZWB9XHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICA8L0JveD5cclxuXHJcbiAgICAgICAgICAgICAgICB7YWN0aXZlQ2FtZXJhcy5sZW5ndGggPyAoXHJcbiAgICAgICAgICAgICAgICAgIDxHcmlkIGNvbnRhaW5lciBzcGFjaW5nPXsxLjI1fSBzeD17eyBtYjogMiB9fT5cclxuICAgICAgICAgICAgICAgICAgICB7YWN0aXZlQ2FtZXJhcy5tYXAoKGNhbSkgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPEdyaWQgaXRlbSB4cz17MTJ9IHNtPXs2fSBrZXk9e2NhbS5pZH0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxUb29sdGlwIHRpdGxlPXtjYW0uYW5vbWFseV9ub3RlIHx8IGNhbS5uYW1lfSBhcnJvdz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8UGFwZXJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJvdXRsaW5lZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzeD17eyBvdmVyZmxvdzogJ2hpZGRlbicsIGJvcmRlclJhZGl1czogMS41LCBib3JkZXJDb2xvcjogY2FtLm9ubGluZSA/ICcjYmFlNmZkJyA6ICcjZTJlOGYwJyB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxCb3ggc3g9e3sgcG9zaXRpb246ICdyZWxhdGl2ZScsIGJnY29sb3I6ICcjMGYxNzJhJyB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2NhbS5vbmxpbmUgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPEJveFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50PVwiaW1nXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYz17YCR7bW9uaXRvcmluZ0FQSS5zbmFwc2hvdFVybChjYW0uaWQpfSZmcmFtZT0ke3RpY2t9YH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsdD17Y2FtLm5hbWV9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzeD17eyBkaXNwbGF5OiAnYmxvY2snLCB3aWR0aDogJzEwMCUnLCBoZWlnaHQ6IDEwOCwgb2JqZWN0Rml0OiAnY292ZXInIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Qm94XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzeD17e1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IDEwOCwgZGlzcGxheTogJ2ZsZXgnLCBmbGV4RGlyZWN0aW9uOiAnY29sdW1uJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWxpZ25JdGVtczogJ2NlbnRlcicsIGp1c3RpZnlDb250ZW50OiAnY2VudGVyJywgY29sb3I6ICcjOTRhM2I4JywgZ2FwOiAwLjUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxXYXJuaW5nSWNvbiBzeD17eyBmb250U2l6ZTogMjIgfX0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxUeXBvZ3JhcGh5IHZhcmlhbnQ9XCJjYXB0aW9uXCI+RmVlZCBvZmZsaW5lPC9UeXBvZ3JhcGh5PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvQm94PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Q2hpcFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsPXtjYW0ub25saW5lID8gJ+KXjyBMSVZFJyA6ICdPRkZMSU5FJ31cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaXplPVwic21hbGxcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yPXtjYW0ub25saW5lID8gJ3N1Y2Nlc3MnIDogJ2RlZmF1bHQnfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN4PXt7IHBvc2l0aW9uOiAnYWJzb2x1dGUnLCB0b3A6IDYsIGxlZnQ6IDYsIGhlaWdodDogMTksIGZvbnRTaXplOiAxMCwgZm9udFdlaWdodDogODAwIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtjYW0udGFtcGVyX2ZsYWcgJiYgY2FtLnRhbXBlcl9mbGFnICE9PSAnbm9ybWFsJyAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPENoaXBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsPXtjYW0udGFtcGVyX2ZsYWcucmVwbGFjZSgvXy9nLCAnICcpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cInNtYWxsXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yPVwiZXJyb3JcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3g9e3sgcG9zaXRpb246ICdhYnNvbHV0ZScsIHRvcDogNiwgcmlnaHQ6IDYsIGhlaWdodDogMTksIGZvbnRTaXplOiAxMCwgZm9udFdlaWdodDogNzAwIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvQm94PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPEJveCBzeD17eyBweDogMSwgcHk6IDAuNzUgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxUeXBvZ3JhcGh5IG5vV3JhcCBzeD17eyBmb250U2l6ZTogMTEuNSwgZm9udFdlaWdodDogNzAwIH19IHRpdGxlPXtjYW0ubmFtZX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2NhbS5uYW1lfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L1R5cG9ncmFwaHk+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxUeXBvZ3JhcGh5IG5vV3JhcCB2YXJpYW50PVwiY2FwdGlvblwiIGNvbG9yPVwidGV4dC5zZWNvbmRhcnlcIiB0aXRsZT17Y2FtLmxvY2F0aW9ufT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Y2FtLmxvY2F0aW9ufVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L1R5cG9ncmFwaHk+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtjYW0uZGV0ZWN0ZWRfaGVhZGNvdW50ICE9IG51bGwgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxUeXBvZ3JhcGh5XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwiY2FwdGlvblwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzeD17e1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNwbGF5OiAnYmxvY2snLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvcjogY2FtLmRldGVjdGVkX2hlYWRjb3VudCA9PT0gY2FtLmFlYmFzX3B1bmNoX2NvdW50ID8gJyMwNTk2NjknIDogJyNkYzI2MjYnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBBSSBoZWFkY291bnQge2NhbS5kZXRlY3RlZF9oZWFkY291bnR9IMK3IEFFQkFTIHtjYW0uYWViYXNfcHVuY2hfY291bnR9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9UeXBvZ3JhcGh5PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9Cb3g+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9QYXBlcj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9Ub29sdGlwPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9HcmlkPlxyXG4gICAgICAgICAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgICAgICAgICA8L0dyaWQ+XHJcbiAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICA8QWxlcnQgc2V2ZXJpdHk9XCJpbmZvXCIgc3g9e3sgbWI6IDIgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgTm8gZ3JvdW5kLWxldmVsIGNhbWVyYXMgcmVnaXN0ZXJlZCBmb3IgdGhpcyBjZW50ZXIgeWV0LlxyXG4gICAgICAgICAgICAgICAgICA8L0FsZXJ0PlxyXG4gICAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAgICA8U3RhY2sgZGlyZWN0aW9uPVwicm93XCIgc3BhY2luZz17MX0gZmxleFdyYXA9XCJ3cmFwXCIgdXNlRmxleEdhcD5cclxuICAgICAgICAgICAgICAgICAgPEJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgIHNpemU9XCJzbWFsbFwiXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyaWFudD1cImNvbnRhaW5lZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgc3RhcnRJY29uPXs8VmlkZW9jYW1JY29uIC8+fVxyXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IG5hdmlnYXRlKCcvbGl2ZScpfVxyXG4gICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgTGl2ZSBDQ1RWIFdhbGxcclxuICAgICAgICAgICAgICAgICAgPC9CdXR0b24+XHJcbiAgICAgICAgICAgICAgICAgIDxCdXR0b24gc2l6ZT1cInNtYWxsXCIgdmFyaWFudD1cIm91dGxpbmVkXCIgb25DbGljaz17KCkgPT4gbmF2aWdhdGUoJy9pbnNwZWN0aW9ucycpfT5cclxuICAgICAgICAgICAgICAgICAgICBJbnNwZWN0aW9uIFJlY29yZHNcclxuICAgICAgICAgICAgICAgICAgPC9CdXR0b24+XHJcbiAgICAgICAgICAgICAgICAgIDxCdXR0b25cclxuICAgICAgICAgICAgICAgICAgICBzaXplPVwic21hbGxcIlxyXG4gICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJvdXRsaW5lZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgc3RhcnRJY29uPXs8U2hpZWxkSWNvbiAvPn1cclxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBuYXZpZ2F0ZSgnL2F0cicpfVxyXG4gICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgRGlnaXRhbCBBVFJcclxuICAgICAgICAgICAgICAgICAgPC9CdXR0b24+XHJcbiAgICAgICAgICAgICAgICA8L1N0YWNrPlxyXG4gICAgICAgICAgICAgIDwvUGFwZXI+XHJcbiAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgPFBhcGVyIHN4PXt7IHA6IDMsIHRleHRBbGlnbjogJ2NlbnRlcicsIGNvbG9yOiAnIzY0NzQ4YicgfX0+XHJcbiAgICAgICAgICAgICAgICBTZWxlY3QgYSBmYWNpbGl0eSBvbiB0aGUgbWFwIHRvIGluc3BlY3QgaXRzIGNlbnRlciBoZWFkIGFuZCBncm91bmQtbGV2ZWwgQ0NUViBjYW1lcmFzLlxyXG4gICAgICAgICAgICAgIDwvUGFwZXI+XHJcbiAgICAgICAgICAgICl9XHJcbiAgICAgICAgICA8L0JveD5cclxuICAgICAgICA8L0dyaWQ+XHJcbiAgICAgIDwvR3JpZD5cclxuXHJcbiAgICAgIDxTbmFja2JhclxyXG4gICAgICAgIG9wZW49e0Jvb2xlYW4odmNOb3RpY2UpfVxyXG4gICAgICAgIGF1dG9IaWRlRHVyYXRpb249ezcwMDB9XHJcbiAgICAgICAgb25DbG9zZT17KCkgPT4gc2V0VmNOb3RpY2UobnVsbCl9XHJcbiAgICAgICAgbWVzc2FnZT17dmNOb3RpY2V9XHJcbiAgICAgICAgYW5jaG9yT3JpZ2luPXt7IHZlcnRpY2FsOiAnYm90dG9tJywgaG9yaXpvbnRhbDogJ2NlbnRlcicgfX1cclxuICAgICAgLz5cclxuICAgIDwvQm94PlxyXG4gICk7XHJcbn07XHJcblxyXG5leHBvcnQgZGVmYXVsdCBHSVNNYXA7XHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuIl0sImZpbGUiOiJDOi9Vc2Vycy9wcmVtYS9Eb3dubG9hZHMvUHJvdG90eXBlL3NhbWFqLWRyaXNodGkvYWRtaW4vc3JjL3BhZ2VzL0dJU01hcC5qc3gifQ==