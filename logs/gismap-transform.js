import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/GISMap.jsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=13fd0c0e"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=13fd0c0e"; const React = __vite__cjsImport3_react.__esModule ? __vite__cjsImport3_react.default : __vite__cjsImport3_react; const useState = __vite__cjsImport3_react["useState"]; const useEffect = __vite__cjsImport3_react["useEffect"]; const useRef = __vite__cjsImport3_react["useRef"]; const useMemo = __vite__cjsImport3_react["useMemo"];
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
  CircularProgress
} from "/node_modules/.vite/deps/@mui_material.js?v=13fd0c0e";
import {
  LocationOn as LocationIcon,
  Videocam as VideocamIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Refresh as RefreshIcon,
  Shield as ShieldIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Public as PublicIcon
} from "/node_modules/.vite/deps/@mui_icons-material.js?v=13fd0c0e";
import { gisAPI, monitoringAPI } from "/src/services/api.js?t=1790698250045";
import { useNavigate } from "/node_modules/.vite/deps/react-router-dom.js?v=13fd0c0e";
const SCHEME_BADGES = {
  AVYAY: { label: "AVYAY (Senior Citizens)", color: "#0284c7", bg: "#e0f2fe" },
  NAPDDR: { label: "NAPDDR (De-Addiction)", color: "#d97706", bg: "#fef3c7" },
  SIPDA: { label: "SIPDA (PwD Skills)", color: "#059669", bg: "#d1fae5" }
};
const SCHEME_COLORS = { AVYAY: "#0284c7", NAPDDR: "#d97706", SIPDA: "#059669" };
const INDIA_CENTER = { lat: 23.4, lng: 78.9 };
const centerColor = (center) => center.status === "flagged" ? "#dc2626" : SCHEME_COLORS[center.scheme] || "#64748b";
const statusChipColor = (status) => status === "flagged" ? "error" : status === "completed" ? "success" : "primary";
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
    gRef.current = { map, markers: [] };
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
      const L = (await import('/node_modules/.vite/deps/leaflet.js?v=49c04772').then(m => m.default && m.default.__esModule ? m.default : ({ ...m.default, default: m.default }))).default;
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
        ).bindTooltip(center.name, { direction: "top" }).on("click", () => setActiveId(center.id)).addTo(layer);
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
      lineNumber: 271,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
      lineNumber: 270,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV(Box, { children: [
    /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 2 }, children: [
      /* @__PURE__ */ jsxDEV(Box, { children: [
        /* @__PURE__ */ jsxDEV(Typography, { variant: "h4", sx: { fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }, children: "🗺️ Real-Time Compliance GIS Map" }, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 280,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(Typography, { variant: "body2", color: "text.secondary", children: "DoSJE National Monitoring · real map of monitored centers · click a center for its in-charge and ground-level CCTV" }, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 283,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 279,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV(Stack, { direction: "row", spacing: 1, alignItems: "center", children: [
        /* @__PURE__ */ jsxDEV(
          Chip,
          {
            size: "small",
            icon: /* @__PURE__ */ jsxDEV(PublicIcon, {}, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 290,
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
            lineNumber: 288,
            columnNumber: 11
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(Button, { variant: "outlined", size: "small", startIcon: /* @__PURE__ */ jsxDEV(RefreshIcon, {}, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 301,
          columnNumber: 62
        }, this), onClick: load, children: "Refresh Feeds" }, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 301,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 287,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
      lineNumber: 278,
      columnNumber: 7
    }, this),
    error && /* @__PURE__ */ jsxDEV(
      Alert,
      {
        severity: "error",
        sx: { mb: 2 },
        action: /* @__PURE__ */ jsxDEV(Button, { color: "inherit", size: "small", onClick: load, children: "Retry" }, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 311,
          columnNumber: 17
        }, this),
        children: error
      },
      void 0,
      false,
      {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 308,
        columnNumber: 7
      },
      this
    ),
    engineNote && /* @__PURE__ */ jsxDEV(Alert, { severity: "info", sx: { mb: 2 }, children: engineNote }, void 0, false, {
      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
      lineNumber: 316,
      columnNumber: 22
    }, this),
    /* @__PURE__ */ jsxDEV(Paper, { sx: { p: 2, mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }, children: [
      /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ jsxDEV(Typography, { variant: "subtitle2", sx: { mr: 1 }, children: "Scheme Filter:" }, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 320,
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
              lineNumber: 322,
              columnNumber: 11
            },
            this
          )
        )
      ] }, void 0, true, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 319,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", gap: 2, fontSize: 13, alignItems: "center", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.5 }, children: [
          /* @__PURE__ */ jsxDEV(Box, { sx: { width: 12, height: 12, borderRadius: "50%", bgcolor: "#16a34a" } }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 337,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { children: "Compliant" }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 338,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 336,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.5 }, children: [
          /* @__PURE__ */ jsxDEV(Box, { sx: { width: 12, height: 12, borderRadius: "50%", bgcolor: "#dc2626" } }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 341,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { children: "Flagged / audit spotlight" }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 342,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 340,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.5 }, children: [
          /* @__PURE__ */ jsxDEV(VideocamIcon, { sx: { fontSize: 15, color: "#0e7490" } }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 345,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { children: [
            centers.reduce((sum, c) => sum + c.camera_count, 0),
            " ground cameras registered"
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 346,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 344,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 335,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
      lineNumber: 318,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Grid, { container: true, spacing: 3, children: [
      /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 12, lg: 8, children: [
        /* @__PURE__ */ jsxDEV(Paper, { sx: { p: 0.75, position: "relative", overflow: "hidden" }, children: [
          /* @__PURE__ */ jsxDEV(Box, { ref: mapRef, sx: { height: 560, width: "100%", borderRadius: 1, bgcolor: "#e8eef6" } }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 354,
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
                  lineNumber: 362,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV(Typography, { variant: "caption", color: "text.secondary", children: "Loading the live map…" }, void 0, false, {
                  fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                  lineNumber: 363,
                  columnNumber: 17
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 356,
              columnNumber: 13
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 353,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", gap: 2.5, flexWrap: "wrap", mt: 1.5, px: 0.5, fontSize: 12.5, color: "#475569" }, children: [
          Object.entries(SCHEME_COLORS).map(
            ([scheme, color]) => /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.7 }, children: [
              /* @__PURE__ */ jsxDEV(Box, { sx: { width: 11, height: 11, borderRadius: "50%", bgcolor: color } }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 370,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("span", { children: SCHEME_BADGES[scheme]?.label || scheme }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 371,
                columnNumber: 17
              }, this)
            ] }, scheme, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 369,
              columnNumber: 13
            }, this)
          ),
          /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.7 }, children: [
            /* @__PURE__ */ jsxDEV(LocationIcon, { sx: { fontSize: 14 } }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 375,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("span", { children: "Click a center pin (or a facility in the list) to open its in-charge and ground-level CCTV." }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 376,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 374,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 367,
          columnNumber: 11
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 352,
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
            lineNumber: 383,
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
                    lineNumber: 407,
                    columnNumber: 23
                  }, this),
                  /* @__PURE__ */ jsxDEV(Typography, { noWrap: true, sx: { fontSize: 12.5, fontWeight: selected ? 700 : 500, flexGrow: 1 }, title: c.name, children: c.name }, void 0, false, {
                    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                    lineNumber: 408,
                    columnNumber: 23
                  }, this),
                  /* @__PURE__ */ jsxDEV(
                    Chip,
                    {
                      size: "small",
                      label: `${c.cameras_online}/${c.camera_count}`,
                      icon: /* @__PURE__ */ jsxDEV(VideocamIcon, { sx: { fontSize: 13 } }, void 0, false, {
                        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                        lineNumber: 414,
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
                      lineNumber: 411,
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
                lineNumber: 390,
                columnNumber: 21
              },
              this
            );
          }) }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 386,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 382,
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
                lineNumber: 428,
                columnNumber: 19
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(Chip, { size: "small", label: activeCenter.status, color: statusChipColor(activeCenter.status) }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 437,
              columnNumber: 19
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 427,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Typography, { variant: "h6", sx: { fontWeight: 700, lineHeight: 1.3 }, children: activeCenter.name }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 440,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Typography, { variant: "caption", color: "text.secondary", sx: { display: "block", mt: 0.5 }, children: [
            "📍 ",
            activeCenter.location
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 443,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Divider, { sx: { my: 1.5 } }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 447,
            columnNumber: 17
          }, this),
          activeCenter.status === "flagged" && /* @__PURE__ */ jsxDEV(Alert, { severity: "error", sx: { mb: 2 }, children: [
            /* @__PURE__ */ jsxDEV("strong", { children: "DoSJE Audit Spotlight:" }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 451,
              columnNumber: 21
            }, this),
            " this center is flagged — CCTV tamper or headcount anomalies were detected. Physically verify before releasing further grants."
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 450,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV(Box, { sx: { bgcolor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 2, p: 1.75, mb: 2 }, children: [
            /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.75, mb: 1 }, children: [
              /* @__PURE__ */ jsxDEV(PersonIcon, { sx: { fontSize: 16, color: "#0369a1" } }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 458,
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
                  lineNumber: 459,
                  columnNumber: 21
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 457,
              columnNumber: 19
            }, this),
            activeCenter.head ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV(Typography, { sx: { fontWeight: 700, fontSize: 15 }, children: activeCenter.head.name }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 468,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV(Typography, { variant: "body2", color: "text.secondary", sx: { mb: 1 }, children: activeCenter.head.designation }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 469,
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
                      lineNumber: 479,
                      columnNumber: 29
                    }, this),
                    label: activeCenter.head.phone,
                    variant: "outlined"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                    lineNumber: 474,
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
                      lineNumber: 490,
                      columnNumber: 29
                    }, this),
                    label: activeCenter.head.email,
                    variant: "outlined"
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                    lineNumber: 485,
                    columnNumber: 21
                  },
                  this
                ),
                activeCenter.head.since && /* @__PURE__ */ jsxDEV(Chip, { size: "small", label: `In-charge since ${activeCenter.head.since}`, variant: "outlined" }, void 0, false, {
                  fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                  lineNumber: 496,
                  columnNumber: 21
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 472,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 467,
              columnNumber: 17
            }, this) : /* @__PURE__ */ jsxDEV(Typography, { variant: "body2", color: "text.secondary", children: "Head-of-center details are not on file for this facility yet." }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 501,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 456,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Box, { sx: { bgcolor: "#f8fafc", p: 1.5, borderRadius: 1.5, mb: 2 }, children: /* @__PURE__ */ jsxDEV(Grid, { container: true, spacing: 1, sx: { fontSize: 12 }, children: [
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "Sanctioned Budget:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 510,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700 }, children: [
                "₹",
                (activeCenter.budget || 0).toLocaleString("en-IN")
              ] }, void 0, true, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 511,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 509,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "Sanction Code:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 514,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700, fontSize: 11 }, children: activeCenter.sanction_code || "—" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 515,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 513,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, sx: { mt: 1 }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "Sanctioned Capacity:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 518,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700 }, children: activeCenter.sanctioned_capacity ?? "—" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 519,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 517,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, sx: { mt: 1 }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "Verified Headcount:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 522,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700 }, children: activeCenter.verified_headcount ?? "—" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 523,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 521,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, sx: { mt: 1 }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "AEBAS Punches:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 526,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700 }, children: activeCenter.aebas_punch_count ?? "—" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 527,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 525,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, sx: { mt: 1 }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "Discrepancy Δ:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 530,
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
                  lineNumber: 531,
                  columnNumber: 23
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 529,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, sx: { mt: 1 }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "NavIC Coordinates:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 541,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700 }, children: activeCenter.geo_coords?.lat != null ? `${activeCenter.geo_coords.lat.toFixed(4)}°N, ${activeCenter.geo_coords.lng.toFixed(4)}°E` : "—" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 542,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 540,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV(Grid, { item: true, xs: 6, sx: { mt: 1 }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { color: "#64748b" }, children: "AI Anomaly Status:" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 549,
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
                  lineNumber: 550,
                  columnNumber: 23
                },
                this
              )
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 548,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 508,
            columnNumber: 19
          }, this) }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 507,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }, children: [
            /* @__PURE__ */ jsxDEV(Box, { sx: { display: "flex", alignItems: "center", gap: 0.75 }, children: [
              /* @__PURE__ */ jsxDEV(VideocamIcon, { sx: { fontSize: 17, color: "#0e7490" } }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 564,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(Typography, { variant: "subtitle2", sx: { fontWeight: 800, color: "#0e7490", letterSpacing: 0.3 }, children: "GROUND-LEVEL CCTV · LIVE" }, void 0, false, {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 565,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 563,
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
                lineNumber: 569,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 562,
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
                        lineNumber: 587,
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
                            lineNumber: 600,
                            columnNumber: 35
                          }, this),
                          /* @__PURE__ */ jsxDEV(Typography, { variant: "caption", children: "Feed offline" }, void 0, false, {
                            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                            lineNumber: 601,
                            columnNumber: 35
                          }, this)
                        ]
                      },
                      void 0,
                      true,
                      {
                        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                        lineNumber: 594,
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
                        lineNumber: 604,
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
                        lineNumber: 611,
                        columnNumber: 25
                      },
                      this
                    )
                  ] }, void 0, true, {
                    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                    lineNumber: 585,
                    columnNumber: 29
                  }, this),
                  /* @__PURE__ */ jsxDEV(Box, { sx: { px: 1, py: 0.75 }, children: [
                    /* @__PURE__ */ jsxDEV(Typography, { noWrap: true, sx: { fontSize: 11.5, fontWeight: 700 }, title: cam.name, children: cam.name }, void 0, false, {
                      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                      lineNumber: 620,
                      columnNumber: 31
                    }, this),
                    /* @__PURE__ */ jsxDEV(Typography, { noWrap: true, variant: "caption", color: "text.secondary", title: cam.location, children: cam.location }, void 0, false, {
                      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                      lineNumber: 623,
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
                        lineNumber: 627,
                        columnNumber: 25
                      },
                      this
                    )
                  ] }, void 0, true, {
                    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                    lineNumber: 619,
                    columnNumber: 29
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 581,
                columnNumber: 27
              },
              this
            ) }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 580,
              columnNumber: 25
            }, this) }, cam.id, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 579,
              columnNumber: 17
            }, this)
          ) }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 577,
            columnNumber: 15
          }, this) : /* @__PURE__ */ jsxDEV(Alert, { severity: "info", sx: { mb: 2 }, children: "No ground-level cameras registered for this center yet." }, void 0, false, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 644,
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
                  lineNumber: 653,
                  columnNumber: 30
                }, this),
                onClick: () => navigate("/live"),
                children: "Live CCTV Wall"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 650,
                columnNumber: 19
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(Button, { size: "small", variant: "outlined", onClick: () => navigate("/inspections"), children: "Inspection Records" }, void 0, false, {
              fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
              lineNumber: 658,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              Button,
              {
                size: "small",
                variant: "outlined",
                startIcon: /* @__PURE__ */ jsxDEV(ShieldIcon, {}, void 0, false, {
                  fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                  lineNumber: 664,
                  columnNumber: 30
                }, this),
                onClick: () => navigate("/atr"),
                children: "Digital ATR"
              },
              void 0,
              false,
              {
                fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
                lineNumber: 661,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
            lineNumber: 649,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 426,
          columnNumber: 13
        }, this) : /* @__PURE__ */ jsxDEV(Paper, { sx: { p: 3, textAlign: "center", color: "#64748b" }, children: "Select a facility on the map to inspect its center head and ground-level CCTV cameras." }, void 0, false, {
          fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
          lineNumber: 672,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 381,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
        lineNumber: 380,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
      lineNumber: 351,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "C:/Users/prema/Downloads/Prototype/samaj-drishti/admin/src/pages/GISMap.jsx",
    lineNumber: 277,
    columnNumber: 5
  }, this);
};
_s(GISMap, "4v1CzB0TZri+EZhB7QnJPFKXYEE=", false, function() {
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

//# sourceMappingURL=data:application/json;base64,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QUE7QUFBQSxhQXVTQSxLQXhTRjtBQUFBO0FBQUE7QUFBQTtBQUFBLGFBeVNBO0FBQUEsU0F0VUY7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQXVVQTtBQUFBLE9BalpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FrWkE7QUFFSjtBQUFFMEMsR0FwbEJJRCxRQUFNO0FBQUEsVUFjTzdDLFdBQVc7QUFBQTtBQUFBLEtBZHhCNkM7QUFzbEJOLGVBQWVBO0FBQU8sSUFBQXNLO0FBQUEsYUFBQUEsSUFBQSIsIm5hbWVzIjpbIlJlYWN0IiwidXNlU3RhdGUiLCJ1c2VFZmZlY3QiLCJ1c2VSZWYiLCJ1c2VNZW1vIiwiQm94IiwiVHlwb2dyYXBoeSIsIlBhcGVyIiwiR3JpZCIsIkNoaXAiLCJCdXR0b24iLCJBbGVydCIsIlN0YWNrIiwiRGl2aWRlciIsIlRvb2x0aXAiLCJDaXJjdWxhclByb2dyZXNzIiwiTG9jYXRpb25PbiIsIkxvY2F0aW9uSWNvbiIsIlZpZGVvY2FtIiwiVmlkZW9jYW1JY29uIiwiV2FybmluZyIsIldhcm5pbmdJY29uIiwiQ2hlY2tDaXJjbGUiLCJDaGVja0NpcmNsZUljb24iLCJSZWZyZXNoIiwiUmVmcmVzaEljb24iLCJTaGllbGQiLCJTaGllbGRJY29uIiwiUGhvbmUiLCJQaG9uZUljb24iLCJFbWFpbCIsIkVtYWlsSWNvbiIsIlBlcnNvbiIsIlBlcnNvbkljb24iLCJQdWJsaWMiLCJQdWJsaWNJY29uIiwiZ2lzQVBJIiwibW9uaXRvcmluZ0FQSSIsInVzZU5hdmlnYXRlIiwiU0NIRU1FX0JBREdFUyIsIkFWWUFZIiwibGFiZWwiLCJjb2xvciIsImJnIiwiTkFQRERSIiwiU0lQREEiLCJTQ0hFTUVfQ09MT1JTIiwiSU5ESUFfQ0VOVEVSIiwibGF0IiwibG5nIiwiY2VudGVyQ29sb3IiLCJjZW50ZXIiLCJzdGF0dXMiLCJzY2hlbWUiLCJzdGF0dXNDaGlwQ29sb3IiLCJsb2FkR29vZ2xlTWFwcyIsImtleSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0Iiwid2luZG93IiwiZ29vZ2xlIiwibWFwcyIsIkVycm9yIiwiZmFpbCIsIndoeSIsImV4aXN0aW5nIiwiZG9jdW1lbnQiLCJnZXRFbGVtZW50QnlJZCIsImNoZWNrIiwiYWRkRXZlbnRMaXN0ZW5lciIsInVuZGVmaW5lZCIsIl9fc2RNYXBzQ2FsbGJhY2siLCJzY3JpcHQiLCJjcmVhdGVFbGVtZW50IiwiaWQiLCJhc3luYyIsInNyYyIsImVuY29kZVVSSUNvbXBvbmVudCIsIm9uZXJyb3IiLCJoZWFkIiwiYXBwZW5kQ2hpbGQiLCJzZXRUaW1lb3V0IiwiR0lTTWFwIiwiX3MiLCJkYXRhIiwic2V0RGF0YSIsImxvYWRpbmciLCJzZXRMb2FkaW5nIiwiZXJyb3IiLCJzZXRFcnJvciIsInNlbGVjdGVkU2NoZW1lIiwic2V0U2VsZWN0ZWRTY2hlbWUiLCJhY3RpdmVJZCIsInNldEFjdGl2ZUlkIiwiZW5naW5lIiwic2V0RW5naW5lIiwiZW5naW5lTm90ZSIsInNldEVuZ2luZU5vdGUiLCJsZWFmbGV0UmVhZHkiLCJzZXRMZWFmbGV0UmVhZHkiLCJ0aWNrIiwic2V0VGljayIsIm1hcFJlZiIsImdSZWYiLCJsUmVmIiwibmF2aWdhdGUiLCJjZW50ZXJzIiwiZmlsdGVyZWRDZW50ZXJzIiwiZmlsdGVyIiwiYyIsInRvVXBwZXJDYXNlIiwiYWN0aXZlQ2VudGVyIiwiZmluZCIsImFjdGl2ZUNhbWVyYXMiLCJjYW1lcmFzIiwib25saW5lQ2FtZXJhcyIsIm9ubGluZSIsImxlbmd0aCIsImxvYWQiLCJyZXMiLCJlcnIiLCJjb25zb2xlIiwiY2FuY2VsbGVkIiwibWFwIiwiYXBpX2tleSIsInRoZW4iLCJjYXRjaCIsIm1lc3NhZ2UiLCJjdXJyZW50IiwiZyIsIk1hcCIsInpvb20iLCJtYXBUeXBlQ29udHJvbCIsInN0cmVldFZpZXdDb250cm9sIiwiZnVsbHNjcmVlbkNvbnRyb2wiLCJjbGlja2FibGVJY29ucyIsIm1hcmtlcnMiLCJnbV9hdXRoRmFpbHVyZSIsImZvckVhY2giLCJtIiwic2V0TWFwIiwiZGlzcG9zZWQiLCJMIiwiZGVmYXVsdCIsImlubmVySFRNTCIsInNldFZpZXciLCJ0aWxlTGF5ZXIiLCJtYXhab29tIiwiYXR0cmlidXRpb24iLCJhZGRUbyIsImxheWVyIiwibGF5ZXJHcm91cCIsInJlbW92ZSIsInNlbGVjdGVkIiwibWFya2VyIiwiTWFya2VyIiwicG9zaXRpb24iLCJnZW9fY29vcmRzIiwidGl0bGUiLCJuYW1lIiwiaWNvbiIsInBhdGgiLCJTeW1ib2xQYXRoIiwiQ0lSQ0xFIiwic2NhbGUiLCJmaWxsQ29sb3IiLCJmaWxsT3BhY2l0eSIsInN0cm9rZUNvbG9yIiwic3Ryb2tlV2VpZ2h0IiwiYWRkTGlzdGVuZXIiLCJwYW5UbyIsImdldFpvb20iLCJzZXRab29tIiwiY2xlYXJMYXllcnMiLCJjaXJjbGVNYXJrZXIiLCJyYWRpdXMiLCJ3ZWlnaHQiLCJiaW5kVG9vbHRpcCIsImRpcmVjdGlvbiIsIm9uIiwiTWF0aCIsIm1heCIsImludGVydmFsIiwic2V0SW50ZXJ2YWwiLCJ0IiwiY2xlYXJJbnRlcnZhbCIsImRpc3BsYXkiLCJqdXN0aWZ5Q29udGVudCIsImFsaWduSXRlbXMiLCJtaW5IZWlnaHQiLCJtYiIsImZsZXhXcmFwIiwiZ2FwIiwiZm9udFdlaWdodCIsInAiLCJtciIsInMiLCJjdXJzb3IiLCJmb250U2l6ZSIsIndpZHRoIiwiaGVpZ2h0IiwiYm9yZGVyUmFkaXVzIiwiYmdjb2xvciIsInJlZHVjZSIsInN1bSIsImNhbWVyYV9jb3VudCIsIm92ZXJmbG93IiwiaW5zZXQiLCJmbGV4RGlyZWN0aW9uIiwibXQiLCJweCIsIk9iamVjdCIsImVudHJpZXMiLCJtYXhIZWlnaHQiLCJweSIsImJvcmRlciIsImJvcmRlckNvbG9yIiwiZmxleFNocmluayIsImZsZXhHcm93IiwiY2FtZXJhc19vbmxpbmUiLCJsaW5lSGVpZ2h0IiwibG9jYXRpb24iLCJteSIsImxldHRlclNwYWNpbmciLCJ0ZXh0VHJhbnNmb3JtIiwiZGVzaWduYXRpb24iLCJwaG9uZSIsImVtYWlsIiwic2luY2UiLCJidWRnZXQiLCJ0b0xvY2FsZVN0cmluZyIsInNhbmN0aW9uX2NvZGUiLCJzYW5jdGlvbmVkX2NhcGFjaXR5IiwidmVyaWZpZWRfaGVhZGNvdW50IiwiYWViYXNfcHVuY2hfY291bnQiLCJkaXNjcmVwYW5jeV9kZWx0YSIsInRvRml4ZWQiLCJjYW0iLCJhbm9tYWx5X25vdGUiLCJzbmFwc2hvdFVybCIsIm9iamVjdEZpdCIsInRvcCIsImxlZnQiLCJ0YW1wZXJfZmxhZyIsInJlcGxhY2UiLCJyaWdodCIsImRldGVjdGVkX2hlYWRjb3VudCIsInRleHRBbGlnbiIsIl9jIl0sInNvdXJjZXMiOlsiR0lTTWFwLmpzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QsIHsgdXNlU3RhdGUsIHVzZUVmZmVjdCwgdXNlUmVmLCB1c2VNZW1vIH0gZnJvbSAncmVhY3QnO1xyXG5pbXBvcnQge1xyXG4gIEJveCwgVHlwb2dyYXBoeSwgUGFwZXIsIEdyaWQsIENoaXAsIEJ1dHRvbiwgQWxlcnQsIFN0YWNrLCBEaXZpZGVyLCBUb29sdGlwLFxyXG4gIENpcmN1bGFyUHJvZ3Jlc3MsXHJcbn0gZnJvbSAnQG11aS9tYXRlcmlhbCc7XHJcbmltcG9ydCB7XHJcbiAgTG9jYXRpb25PbiBhcyBMb2NhdGlvbkljb24sXHJcbiAgVmlkZW9jYW0gYXMgVmlkZW9jYW1JY29uLFxyXG4gIFdhcm5pbmcgYXMgV2FybmluZ0ljb24sXHJcbiAgQ2hlY2tDaXJjbGUgYXMgQ2hlY2tDaXJjbGVJY29uLFxyXG4gIFJlZnJlc2ggYXMgUmVmcmVzaEljb24sXHJcbiAgU2hpZWxkIGFzIFNoaWVsZEljb24sXHJcbiAgUGhvbmUgYXMgUGhvbmVJY29uLFxyXG4gIEVtYWlsIGFzIEVtYWlsSWNvbixcclxuICBQZXJzb24gYXMgUGVyc29uSWNvbixcclxuICBQdWJsaWMgYXMgUHVibGljSWNvbixcclxufSBmcm9tICdAbXVpL2ljb25zLW1hdGVyaWFsJztcclxuaW1wb3J0IHsgZ2lzQVBJLCBtb25pdG9yaW5nQVBJIH0gZnJvbSAnLi4vc2VydmljZXMvYXBpJztcclxuaW1wb3J0IHsgdXNlTmF2aWdhdGUgfSBmcm9tICdyZWFjdC1yb3V0ZXItZG9tJztcclxuXHJcbmNvbnN0IFNDSEVNRV9CQURHRVMgPSB7XHJcbiAgQVZZQVk6IHsgbGFiZWw6ICdBVllBWSAoU2VuaW9yIENpdGl6ZW5zKScsIGNvbG9yOiAnIzAyODRjNycsIGJnOiAnI2UwZjJmZScgfSxcclxuICBOQVBERFI6IHsgbGFiZWw6ICdOQVBERFIgKERlLUFkZGljdGlvbiknLCBjb2xvcjogJyNkOTc3MDYnLCBiZzogJyNmZWYzYzcnIH0sXHJcbiAgU0lQREE6IHsgbGFiZWw6ICdTSVBEQSAoUHdEIFNraWxscyknLCBjb2xvcjogJyMwNTk2NjknLCBiZzogJyNkMWZhZTUnIH0sXHJcbn07XHJcblxyXG5jb25zdCBTQ0hFTUVfQ09MT1JTID0geyBBVllBWTogJyMwMjg0YzcnLCBOQVBERFI6ICcjZDk3NzA2JywgU0lQREE6ICcjMDU5NjY5JyB9O1xyXG5jb25zdCBJTkRJQV9DRU5URVIgPSB7IGxhdDogMjMuNCwgbG5nOiA3OC45IH07XHJcblxyXG5jb25zdCBjZW50ZXJDb2xvciA9IChjZW50ZXIpID0+XHJcbiAgY2VudGVyLnN0YXR1cyA9PT0gJ2ZsYWdnZWQnID8gJyNkYzI2MjYnIDogU0NIRU1FX0NPTE9SU1tjZW50ZXIuc2NoZW1lXSB8fCAnIzY0NzQ4Yic7XHJcblxyXG5jb25zdCBzdGF0dXNDaGlwQ29sb3IgPSAoc3RhdHVzKSA9PlxyXG4gIHN0YXR1cyA9PT0gJ2ZsYWdnZWQnID8gJ2Vycm9yJyA6IHN0YXR1cyA9PT0gJ2NvbXBsZXRlZCcgPyAnc3VjY2VzcycgOiAncHJpbWFyeSc7XHJcblxyXG4vKiogTG9hZHMgdGhlIEdvb2dsZSBNYXBzIEpTIEFQSSBvbmNlLCB3aXRoIHRoZSBrZXkgc2VydmVkIGJ5IG91ciBiYWNrZW5kLiAqL1xyXG5jb25zdCBsb2FkR29vZ2xlTWFwcyA9IChrZXkpID0+XHJcbiAgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgaWYgKHdpbmRvdy5nb29nbGUgJiYgd2luZG93Lmdvb2dsZS5tYXBzKSByZXR1cm4gcmVzb2x2ZSgpO1xyXG4gICAgaWYgKCFrZXkpIHJldHVybiByZWplY3QobmV3IEVycm9yKCduby1rZXknKSk7XHJcblxyXG4gICAgY29uc3QgZmFpbCA9ICh3aHkpID0+IHJlamVjdChuZXcgRXJyb3Iod2h5KSk7XHJcbiAgICBjb25zdCBleGlzdGluZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZC1nb29nbGUtbWFwcycpO1xyXG4gICAgY29uc3QgY2hlY2sgPSAoKSA9PlxyXG4gICAgICB3aW5kb3cuZ29vZ2xlICYmIHdpbmRvdy5nb29nbGUubWFwcyA/IHJlc29sdmUoKSA6IGZhaWwoJ2luaXQtZmFpbGVkJyk7XHJcblxyXG4gICAgaWYgKGV4aXN0aW5nKSB7XHJcbiAgICAgIGV4aXN0aW5nLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBjaGVjayk7XHJcbiAgICAgIGV4aXN0aW5nLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgKCkgPT4gZmFpbCgnbG9hZC1lcnJvcicpKTtcclxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICB3aW5kb3cuX19zZE1hcHNDYWxsYmFjayA9IGNoZWNrO1xyXG4gICAgY29uc3Qgc2NyaXB0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XHJcbiAgICBzY3JpcHQuaWQgPSAnc2QtZ29vZ2xlLW1hcHMnO1xyXG4gICAgc2NyaXB0LmFzeW5jID0gdHJ1ZTtcclxuICAgIHNjcmlwdC5zcmMgPSBgaHR0cHM6Ly9tYXBzLmdvb2dsZWFwaXMuY29tL21hcHMvYXBpL2pzP2tleT0ke2VuY29kZVVSSUNvbXBvbmVudChrZXkpfSZsb2FkaW5nPWFzeW5jJmNhbGxiYWNrPV9fc2RNYXBzQ2FsbGJhY2tgO1xyXG4gICAgc2NyaXB0Lm9uZXJyb3IgPSAoKSA9PiBmYWlsKCdsb2FkLWVycm9yJyk7XHJcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHNjcmlwdCk7XHJcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgaWYgKCEod2luZG93Lmdvb2dsZSAmJiB3aW5kb3cuZ29vZ2xlLm1hcHMpKSBmYWlsKCd0aW1lb3V0Jyk7XHJcbiAgICB9LCAxMDAwMCk7XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH0pO1xyXG5cclxuY29uc3QgR0lTTWFwID0gKCkgPT4ge1xyXG4gIGNvbnN0IFtkYXRhLCBzZXREYXRhXSA9IHVzZVN0YXRlKG51bGwpO1xyXG4gIGNvbnN0IFtsb2FkaW5nLCBzZXRMb2FkaW5nXSA9IHVzZVN0YXRlKHRydWUpO1xyXG4gIGNvbnN0IFtlcnJvciwgc2V0RXJyb3JdID0gdXNlU3RhdGUobnVsbCk7XHJcbiAgY29uc3QgW3NlbGVjdGVkU2NoZW1lLCBzZXRTZWxlY3RlZFNjaGVtZV0gPSB1c2VTdGF0ZSgnQUxMJyk7XHJcbiAgY29uc3QgW2FjdGl2ZUlkLCBzZXRBY3RpdmVJZF0gPSB1c2VTdGF0ZShudWxsKTtcclxuICBjb25zdCBbZW5naW5lLCBzZXRFbmdpbmVdID0gdXNlU3RhdGUoJ3BlbmRpbmcnKTsgLy8gcGVuZGluZyB8IGdvb2dsZSB8IGxlYWZsZXRcclxuICBjb25zdCBbZW5naW5lTm90ZSwgc2V0RW5naW5lTm90ZV0gPSB1c2VTdGF0ZShudWxsKTtcclxuICBjb25zdCBbbGVhZmxldFJlYWR5LCBzZXRMZWFmbGV0UmVhZHldID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFt0aWNrLCBzZXRUaWNrXSA9IHVzZVN0YXRlKDApO1xyXG5cclxuICBjb25zdCBtYXBSZWYgPSB1c2VSZWYobnVsbCk7XHJcbiAgY29uc3QgZ1JlZiA9IHVzZVJlZihudWxsKTsgLy8geyBtYXAsIG1hcmtlcnMgfVxyXG4gIGNvbnN0IGxSZWYgPSB1c2VSZWYobnVsbCk7IC8vIHsgbWFwLCBsYXllciwgTCB9XHJcbiAgY29uc3QgbmF2aWdhdGUgPSB1c2VOYXZpZ2F0ZSgpO1xyXG5cclxuICBjb25zdCBjZW50ZXJzID0gdXNlTWVtbygoKSA9PiBkYXRhPy5jZW50ZXJzIHx8IFtdLCBbZGF0YV0pO1xyXG4gIGNvbnN0IGZpbHRlcmVkQ2VudGVycyA9IHVzZU1lbW8oXHJcbiAgICAoKSA9PiBjZW50ZXJzLmZpbHRlcigoYykgPT4gc2VsZWN0ZWRTY2hlbWUgPT09ICdBTEwnIHx8IChjLnNjaGVtZSB8fCAnJykudG9VcHBlckNhc2UoKSA9PT0gc2VsZWN0ZWRTY2hlbWUpLFxyXG4gICAgW2NlbnRlcnMsIHNlbGVjdGVkU2NoZW1lXVxyXG4gICk7XHJcbiAgY29uc3QgYWN0aXZlQ2VudGVyID0gdXNlTWVtbyhcclxuICAgICgpID0+IGZpbHRlcmVkQ2VudGVycy5maW5kKChjKSA9PiBjLmlkID09PSBhY3RpdmVJZCkgfHwgZmlsdGVyZWRDZW50ZXJzWzBdIHx8IG51bGwsXHJcbiAgICBbZmlsdGVyZWRDZW50ZXJzLCBhY3RpdmVJZF1cclxuICApO1xyXG4gIGNvbnN0IGFjdGl2ZUNhbWVyYXMgPSBhY3RpdmVDZW50ZXI/LmNhbWVyYXMgfHwgW107XHJcbiAgY29uc3Qgb25saW5lQ2FtZXJhcyA9IGFjdGl2ZUNhbWVyYXMuZmlsdGVyKChjKSA9PiBjLm9ubGluZSkubGVuZ3RoO1xyXG5cclxuICBjb25zdCBsb2FkID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgc2V0TG9hZGluZyh0cnVlKTtcclxuICAgIHNldEVycm9yKG51bGwpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmVzID0gYXdhaXQgZ2lzQVBJLmNlbnRlcnMoKTtcclxuICAgICAgc2V0RGF0YShyZXMuZGF0YSk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignR0lTIGxvYWQgZXJyb3I6JywgZXJyKTtcclxuICAgICAgc2V0RXJyb3IoJ0NvdWxkIG5vdCBsb2FkIHRoZSBjb21wbGlhbmNlIEdJUyBmZWVkLiBJcyB0aGUgQVBJIHJ1bm5pbmcgb24gcG9ydCA1MDAwPycpO1xyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGxvYWQoKTtcclxuICB9LCBbXSk7XHJcblxyXG4gIC8vIFBpY2sgdGhlIHJlYWwtbWFwIGVuZ2luZTogR29vZ2xlIE1hcHMgd2l0aCB0aGUgYmFja2VuZCBrZXksIE9TTSBmYWxsYmFjay5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKCFkYXRhKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgbGV0IGNhbmNlbGxlZCA9IGZhbHNlO1xyXG4gICAgbG9hZEdvb2dsZU1hcHMoZGF0YS5tYXA/LmFwaV9rZXkpXHJcbiAgICAgIC50aGVuKCgpID0+ICFjYW5jZWxsZWQgJiYgc2V0RW5naW5lKCdnb29nbGUnKSlcclxuICAgICAgLmNhdGNoKChlcnIpID0+IHtcclxuICAgICAgICBpZiAoY2FuY2VsbGVkKSByZXR1cm47XHJcbiAgICAgICAgc2V0RW5naW5lKCdsZWFmbGV0Jyk7XHJcbiAgICAgICAgc2V0RW5naW5lTm90ZShcclxuICAgICAgICAgIGVyci5tZXNzYWdlID09PSAnbm8ta2V5J1xyXG4gICAgICAgICAgICA/ICdObyBHb29nbGUgTWFwcyBBUEkga2V5IGNvbmZpZ3VyZWQgb24gdGhlIGJhY2tlbmQg4oCUIHVzaW5nIE9wZW5TdHJlZXRNYXAgdGlsZXMuJ1xyXG4gICAgICAgICAgICA6ICdHb29nbGUgTWFwcyBjb3VsZCBub3QgaW5pdGlhbGlzZSB3aXRoIHRoaXMga2V5IG9uIHRoaXMgbWFjaGluZSDigJQgdXNpbmcgT3BlblN0cmVldE1hcCB0aWxlcy4nXHJcbiAgICAgICAgKTtcclxuICAgICAgfSk7XHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICBjYW5jZWxsZWQgPSB0cnVlO1xyXG4gICAgfTtcclxuICB9LCBbZGF0YV0pO1xyXG5cclxuICAvLyBHb29nbGUgbWFwIGluc3RhbmNlLlxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBpZiAoZW5naW5lICE9PSAnZ29vZ2xlJyB8fCAhZGF0YSB8fCAhbWFwUmVmLmN1cnJlbnQgfHwgZ1JlZi5jdXJyZW50KSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgY29uc3QgZyA9IHdpbmRvdy5nb29nbGUubWFwcztcclxuICAgIGNvbnN0IG1hcCA9IG5ldyBnLk1hcChtYXBSZWYuY3VycmVudCwge1xyXG4gICAgICBjZW50ZXI6IElORElBX0NFTlRFUixcclxuICAgICAgem9vbTogNSxcclxuICAgICAgbWFwVHlwZUNvbnRyb2w6IHRydWUsXHJcbiAgICAgIHN0cmVldFZpZXdDb250cm9sOiBmYWxzZSxcclxuICAgICAgZnVsbHNjcmVlbkNvbnRyb2w6IHRydWUsXHJcbiAgICAgIGNsaWNrYWJsZUljb25zOiBmYWxzZSxcclxuICAgIH0pO1xyXG4gICAgZ1JlZi5jdXJyZW50ID0geyBtYXAsIG1hcmtlcnM6IFtdIH07XHJcbiAgICAvLyBJZiBHb29nbGUgcmVqZWN0cyB0aGUga2V5IGFmdGVyIChsYXp5KSBhdXRoLCBkZWdyYWRlIHRvIE9TTSBpbnN0ZWFkIG9mIGEgZ3JleSBtYXAuXHJcbiAgICB3aW5kb3cuZ21fYXV0aEZhaWx1cmUgPSAoKSA9PiB7XHJcbiAgICAgIHNldEVuZ2luZSgnbGVhZmxldCcpO1xyXG4gICAgICBzZXRFbmdpbmVOb3RlKCdHb29nbGUgTWFwcyByZWplY3RlZCB0aGlzIGtleSAoYXV0aCBmYWlsdXJlKSDigJQgc3dpdGNoZWQgdG8gT3BlblN0cmVldE1hcCB0aWxlcy4nKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICAoZ1JlZi5jdXJyZW50Py5tYXJrZXJzIHx8IFtdKS5mb3JFYWNoKChtKSA9PiBtLnNldE1hcChudWxsKSk7XHJcbiAgICAgIGdSZWYuY3VycmVudCA9IG51bGw7XHJcbiAgICB9O1xyXG4gIH0sIFtlbmdpbmUsIGRhdGFdKTtcclxuXHJcbiAgLy8gTGVhZmxldCBmYWxsYmFjayBpbnN0YW5jZSAobG9hZGVkIGxhemlseSBzbyBpdCBuZXZlciB3ZWlnaHMgb24gdGhlIGJ1bmRsZSkuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmIChlbmdpbmUgIT09ICdsZWFmbGV0JyB8fCAhZGF0YSB8fCAhbWFwUmVmLmN1cnJlbnQgfHwgbFJlZi5jdXJyZW50KSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgbGV0IGRpc3Bvc2VkID0gZmFsc2U7XHJcbiAgICAoYXN5bmMgKCkgPT4ge1xyXG4gICAgICBjb25zdCBMID0gKGF3YWl0IGltcG9ydCgnbGVhZmxldCcpKS5kZWZhdWx0O1xyXG4gICAgICBhd2FpdCBpbXBvcnQoJ2xlYWZsZXQvZGlzdC9sZWFmbGV0LmNzcycpO1xyXG4gICAgICBpZiAoZGlzcG9zZWQgfHwgIW1hcFJlZi5jdXJyZW50KSByZXR1cm47XHJcbiAgICAgIG1hcFJlZi5jdXJyZW50LmlubmVySFRNTCA9ICcnO1xyXG4gICAgICBjb25zdCBtYXAgPSBMLm1hcChtYXBSZWYuY3VycmVudCkuc2V0VmlldyhbSU5ESUFfQ0VOVEVSLmxhdCwgSU5ESUFfQ0VOVEVSLmxuZ10sIDUpO1xyXG4gICAgICBMLnRpbGVMYXllcignaHR0cHM6Ly97c30udGlsZS5vcGVuc3RyZWV0bWFwLm9yZy97en0ve3h9L3t5fS5wbmcnLCB7XHJcbiAgICAgICAgbWF4Wm9vbTogMTksXHJcbiAgICAgICAgYXR0cmlidXRpb246ICcmY29weTsgT3BlblN0cmVldE1hcCBjb250cmlidXRvcnMnLFxyXG4gICAgICB9KS5hZGRUbyhtYXApO1xyXG4gICAgICBsUmVmLmN1cnJlbnQgPSB7IG1hcCwgbGF5ZXI6IEwubGF5ZXJHcm91cCgpLmFkZFRvKG1hcCksIEwgfTtcclxuICAgICAgc2V0TGVhZmxldFJlYWR5KHRydWUpO1xyXG4gICAgfSkoKTtcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGRpc3Bvc2VkID0gdHJ1ZTtcclxuICAgICAgaWYgKGxSZWYuY3VycmVudD8ubWFwKSBsUmVmLmN1cnJlbnQubWFwLnJlbW92ZSgpO1xyXG4gICAgICBsUmVmLmN1cnJlbnQgPSBudWxsO1xyXG4gICAgICBzZXRMZWFmbGV0UmVhZHkoZmFsc2UpO1xyXG4gICAgfTtcclxuICB9LCBbZW5naW5lLCBkYXRhXSk7XHJcblxyXG4gIC8vIEtlZXAgdGhlIG1hcmtlcnMgaW4gc3luYyB3aXRoIHRoZSBmaWx0ZXIgYW5kIHRoZSBzZWxlY3RlZCBjZW50ZXIuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmICghYWN0aXZlQ2VudGVyKSByZXR1cm47XHJcbiAgICBpZiAoZW5naW5lID09PSAnZ29vZ2xlJyAmJiBnUmVmLmN1cnJlbnQpIHtcclxuICAgICAgY29uc3QgZyA9IHdpbmRvdy5nb29nbGUubWFwcztcclxuICAgICAgY29uc3QgeyBtYXAsIG1hcmtlcnMgfSA9IGdSZWYuY3VycmVudDtcclxuICAgICAgbWFya2Vycy5mb3JFYWNoKChtKSA9PiBtLnNldE1hcChudWxsKSk7XHJcbiAgICAgIGdSZWYuY3VycmVudC5tYXJrZXJzID0gZmlsdGVyZWRDZW50ZXJzLm1hcCgoY2VudGVyKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWQgPSBjZW50ZXIuaWQgPT09IGFjdGl2ZUNlbnRlci5pZDtcclxuICAgICAgICBjb25zdCBtYXJrZXIgPSBuZXcgZy5NYXJrZXIoe1xyXG4gICAgICAgICAgcG9zaXRpb246IHtcclxuICAgICAgICAgICAgbGF0OiBjZW50ZXIuZ2VvX2Nvb3Jkcz8ubGF0IHx8IElORElBX0NFTlRFUi5sYXQsXHJcbiAgICAgICAgICAgIGxuZzogY2VudGVyLmdlb19jb29yZHM/LmxuZyB8fCBJTkRJQV9DRU5URVIubG5nLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIG1hcCxcclxuICAgICAgICAgIHRpdGxlOiBjZW50ZXIubmFtZSxcclxuICAgICAgICAgIGljb246IHtcclxuICAgICAgICAgICAgcGF0aDogZy5TeW1ib2xQYXRoLkNJUkNMRSxcclxuICAgICAgICAgICAgc2NhbGU6IHNlbGVjdGVkID8gMTEgOiA4LFxyXG4gICAgICAgICAgICBmaWxsQ29sb3I6IGNlbnRlckNvbG9yKGNlbnRlciksXHJcbiAgICAgICAgICAgIGZpbGxPcGFjaXR5OiBzZWxlY3RlZCA/IDEgOiAwLjg1LFxyXG4gICAgICAgICAgICBzdHJva2VDb2xvcjogJyNmZmZmZmYnLFxyXG4gICAgICAgICAgICBzdHJva2VXZWlnaHQ6IDIsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIG1hcmtlci5hZGRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiBzZXRBY3RpdmVJZChjZW50ZXIuaWQpKTtcclxuICAgICAgICByZXR1cm4gbWFya2VyO1xyXG4gICAgICB9KTtcclxuICAgICAgaWYgKGFjdGl2ZUNlbnRlci5nZW9fY29vcmRzPy5sYXQpIHtcclxuICAgICAgICBtYXAucGFuVG8oeyBsYXQ6IGFjdGl2ZUNlbnRlci5nZW9fY29vcmRzLmxhdCwgbG5nOiBhY3RpdmVDZW50ZXIuZ2VvX2Nvb3Jkcy5sbmcgfSk7XHJcbiAgICAgICAgaWYgKChtYXAuZ2V0Wm9vbSgpIHx8IDUpIDwgNykgbWFwLnNldFpvb20oOSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGlmIChlbmdpbmUgPT09ICdsZWFmbGV0JyAmJiBsUmVmLmN1cnJlbnQgJiYgbGVhZmxldFJlYWR5KSB7XHJcbiAgICAgIGNvbnN0IHsgbWFwLCBsYXllciwgTCB9ID0gbFJlZi5jdXJyZW50O1xyXG4gICAgICBsYXllci5jbGVhckxheWVycygpO1xyXG4gICAgICBmaWx0ZXJlZENlbnRlcnMuZm9yRWFjaCgoY2VudGVyKSA9PiB7XHJcbiAgICAgICAgY29uc3Qgc2VsZWN0ZWQgPSBjZW50ZXIuaWQgPT09IGFjdGl2ZUNlbnRlci5pZDtcclxuICAgICAgICBMLmNpcmNsZU1hcmtlcihcclxuICAgICAgICAgIFtjZW50ZXIuZ2VvX2Nvb3Jkcz8ubGF0IHx8IElORElBX0NFTlRFUi5sYXQsIGNlbnRlci5nZW9fY29vcmRzPy5sbmcgfHwgSU5ESUFfQ0VOVEVSLmxuZ10sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHJhZGl1czogc2VsZWN0ZWQgPyAxMCA6IDcsXHJcbiAgICAgICAgICAgIGNvbG9yOiAnI2ZmZmZmZicsXHJcbiAgICAgICAgICAgIHdlaWdodDogMixcclxuICAgICAgICAgICAgZmlsbENvbG9yOiBjZW50ZXJDb2xvcihjZW50ZXIpLFxyXG4gICAgICAgICAgICBmaWxsT3BhY2l0eTogc2VsZWN0ZWQgPyAxIDogMC44NSxcclxuICAgICAgICAgIH1cclxuICAgICAgICApXHJcbiAgICAgICAgICAuYmluZFRvb2x0aXAoY2VudGVyLm5hbWUsIHsgZGlyZWN0aW9uOiAndG9wJyB9KVxyXG4gICAgICAgICAgLm9uKCdjbGljaycsICgpID0+IHNldEFjdGl2ZUlkKGNlbnRlci5pZCkpXHJcbiAgICAgICAgICAuYWRkVG8obGF5ZXIpO1xyXG4gICAgICB9KTtcclxuICAgICAgaWYgKGFjdGl2ZUNlbnRlci5nZW9fY29vcmRzPy5sYXQpIHtcclxuICAgICAgICBtYXAuc2V0VmlldyhcclxuICAgICAgICAgIFthY3RpdmVDZW50ZXIuZ2VvX2Nvb3Jkcy5sYXQsIGFjdGl2ZUNlbnRlci5nZW9fY29vcmRzLmxuZ10sXHJcbiAgICAgICAgICBNYXRoLm1heChtYXAuZ2V0Wm9vbSgpIHx8IDUsIDgpXHJcbiAgICAgICAgKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0sIFtlbmdpbmUsIGZpbHRlcmVkQ2VudGVycywgYWN0aXZlQ2VudGVyLCBsZWFmbGV0UmVhZHldKTtcclxuXHJcbiAgLy8gTGl2ZSBzbmFwc2hvdHM6IHJlZnJlc2ggdGhlIGdyb3VuZC1DQ1RWIHdhbGwgZXZlcnkgNCBzLlxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBpZiAoIW9ubGluZUNhbWVyYXMpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHNldFRpY2soKHQpID0+IHQgKyAxKSwgNDAwMCk7XHJcbiAgICByZXR1cm4gKCkgPT4gY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XHJcbiAgfSwgW2FjdGl2ZUNlbnRlcj8uaWQsIG9ubGluZUNhbWVyYXNdKTtcclxuXHJcbiAgaWYgKGxvYWRpbmcgJiYgIWRhdGEpIHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIDxCb3ggc3g9e3sgZGlzcGxheTogJ2ZsZXgnLCBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBtaW5IZWlnaHQ6IDQyMCB9fT5cclxuICAgICAgICA8Q2lyY3VsYXJQcm9ncmVzcyAvPlxyXG4gICAgICA8L0JveD5cclxuICAgICk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gKFxyXG4gICAgPEJveD5cclxuICAgICAgPEJveCBzeD17eyBkaXNwbGF5OiAnZmxleCcsIGp1c3RpZnlDb250ZW50OiAnc3BhY2UtYmV0d2VlbicsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBtYjogMiwgZmxleFdyYXA6ICd3cmFwJywgZ2FwOiAyIH19PlxyXG4gICAgICAgIDxCb3g+XHJcbiAgICAgICAgICA8VHlwb2dyYXBoeSB2YXJpYW50PVwiaDRcIiBzeD17eyBmb250V2VpZ2h0OiA3MDAsIGRpc3BsYXk6ICdmbGV4JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIGdhcDogMSB9fT5cclxuICAgICAgICAgICAg8J+Xuu+4jyBSZWFsLVRpbWUgQ29tcGxpYW5jZSBHSVMgTWFwXHJcbiAgICAgICAgICA8L1R5cG9ncmFwaHk+XHJcbiAgICAgICAgICA8VHlwb2dyYXBoeSB2YXJpYW50PVwiYm9keTJcIiBjb2xvcj1cInRleHQuc2Vjb25kYXJ5XCI+XHJcbiAgICAgICAgICAgIERvU0pFIE5hdGlvbmFsIE1vbml0b3JpbmcgwrcgcmVhbCBtYXAgb2YgbW9uaXRvcmVkIGNlbnRlcnMgwrcgY2xpY2sgYSBjZW50ZXIgZm9yIGl0cyBpbi1jaGFyZ2UgYW5kIGdyb3VuZC1sZXZlbCBDQ1RWXHJcbiAgICAgICAgICA8L1R5cG9ncmFwaHk+XHJcbiAgICAgICAgPC9Cb3g+XHJcbiAgICAgICAgPFN0YWNrIGRpcmVjdGlvbj1cInJvd1wiIHNwYWNpbmc9ezF9IGFsaWduSXRlbXM9XCJjZW50ZXJcIj5cclxuICAgICAgICAgIDxDaGlwXHJcbiAgICAgICAgICAgIHNpemU9XCJzbWFsbFwiXHJcbiAgICAgICAgICAgIGljb249ezxQdWJsaWNJY29uIC8+fVxyXG4gICAgICAgICAgICBsYWJlbD17XHJcbiAgICAgICAgICAgICAgZW5naW5lID09PSAnZ29vZ2xlJ1xyXG4gICAgICAgICAgICAgICAgPyAnR29vZ2xlIE1hcHMgwrcgbGl2ZSBrZXknXHJcbiAgICAgICAgICAgICAgICA6IGVuZ2luZSA9PT0gJ2xlYWZsZXQnXHJcbiAgICAgICAgICAgICAgICAgID8gJ09wZW5TdHJlZXRNYXAgZmFsbGJhY2snXHJcbiAgICAgICAgICAgICAgICAgIDogJ0xvYWRpbmcgbWFw4oCmJ1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbG9yPXtlbmdpbmUgPT09ICdnb29nbGUnID8gJ3N1Y2Nlc3MnIDogJ2RlZmF1bHQnfVxyXG4gICAgICAgICAgICB2YXJpYW50PVwib3V0bGluZWRcIlxyXG4gICAgICAgICAgLz5cclxuICAgICAgICAgIDxCdXR0b24gdmFyaWFudD1cIm91dGxpbmVkXCIgc2l6ZT1cInNtYWxsXCIgc3RhcnRJY29uPXs8UmVmcmVzaEljb24gLz59IG9uQ2xpY2s9e2xvYWR9PlxyXG4gICAgICAgICAgICBSZWZyZXNoIEZlZWRzXHJcbiAgICAgICAgICA8L0J1dHRvbj5cclxuICAgICAgICA8L1N0YWNrPlxyXG4gICAgICA8L0JveD5cclxuXHJcbiAgICAgIHtlcnJvciAmJiAoXHJcbiAgICAgICAgPEFsZXJ0XHJcbiAgICAgICAgICBzZXZlcml0eT1cImVycm9yXCJcclxuICAgICAgICAgIHN4PXt7IG1iOiAyIH19XHJcbiAgICAgICAgICBhY3Rpb249ezxCdXR0b24gY29sb3I9XCJpbmhlcml0XCIgc2l6ZT1cInNtYWxsXCIgb25DbGljaz17bG9hZH0+UmV0cnk8L0J1dHRvbj59XHJcbiAgICAgICAgPlxyXG4gICAgICAgICAge2Vycm9yfVxyXG4gICAgICAgIDwvQWxlcnQ+XHJcbiAgICAgICl9XHJcbiAgICAgIHtlbmdpbmVOb3RlICYmIDxBbGVydCBzZXZlcml0eT1cImluZm9cIiBzeD17eyBtYjogMiB9fT57ZW5naW5lTm90ZX08L0FsZXJ0Pn1cclxuXHJcbiAgICAgIDxQYXBlciBzeD17eyBwOiAyLCBtYjogMywgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywganVzdGlmeUNvbnRlbnQ6ICdzcGFjZS1iZXR3ZWVuJywgZmxleFdyYXA6ICd3cmFwJywgZ2FwOiAyIH19PlxyXG4gICAgICAgIDxCb3ggc3g9e3sgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiAxLCBmbGV4V3JhcDogJ3dyYXAnIH19PlxyXG4gICAgICAgICAgPFR5cG9ncmFwaHkgdmFyaWFudD1cInN1YnRpdGxlMlwiIHN4PXt7IG1yOiAxIH19PlNjaGVtZSBGaWx0ZXI6PC9UeXBvZ3JhcGh5PlxyXG4gICAgICAgICAge1snQUxMJywgJ0FWWUFZJywgJ05BUEREUicsICdTSVBEQSddLm1hcCgocykgPT4gKFxyXG4gICAgICAgICAgICA8Q2hpcFxyXG4gICAgICAgICAgICAgIGtleT17c31cclxuICAgICAgICAgICAgICBsYWJlbD17cyA9PT0gJ0FMTCcgPyBgQWxsIEZhY2lsaXRpZXMgKCR7Y2VudGVycy5sZW5ndGh9KWAgOiBTQ0hFTUVfQkFER0VTW3NdPy5sYWJlbCB8fCBzfVxyXG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcclxuICAgICAgICAgICAgICAgIHNldFNlbGVjdGVkU2NoZW1lKHMpO1xyXG4gICAgICAgICAgICAgICAgc2V0QWN0aXZlSWQobnVsbCk7XHJcbiAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICBjb2xvcj17c2VsZWN0ZWRTY2hlbWUgPT09IHMgPyAncHJpbWFyeScgOiAnZGVmYXVsdCd9XHJcbiAgICAgICAgICAgICAgdmFyaWFudD17c2VsZWN0ZWRTY2hlbWUgPT09IHMgPyAnZmlsbGVkJyA6ICdvdXRsaW5lZCd9XHJcbiAgICAgICAgICAgICAgc3g9e3sgZm9udFdlaWdodDogNjAwLCBjdXJzb3I6ICdwb2ludGVyJyB9fVxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgKSl9XHJcbiAgICAgICAgPC9Cb3g+XHJcbiAgICAgICAgPEJveCBzeD17eyBkaXNwbGF5OiAnZmxleCcsIGdhcDogMiwgZm9udFNpemU6IDEzLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZmxleFdyYXA6ICd3cmFwJyB9fT5cclxuICAgICAgICAgIDxCb3ggc3g9e3sgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiAwLjUgfX0+XHJcbiAgICAgICAgICAgIDxCb3ggc3g9e3sgd2lkdGg6IDEyLCBoZWlnaHQ6IDEyLCBib3JkZXJSYWRpdXM6ICc1MCUnLCBiZ2NvbG9yOiAnIzE2YTM0YScgfX0gLz5cclxuICAgICAgICAgICAgPHNwYW4+Q29tcGxpYW50PC9zcGFuPlxyXG4gICAgICAgICAgPC9Cb3g+XHJcbiAgICAgICAgICA8Qm94IHN4PXt7IGRpc3BsYXk6ICdmbGV4JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIGdhcDogMC41IH19PlxyXG4gICAgICAgICAgICA8Qm94IHN4PXt7IHdpZHRoOiAxMiwgaGVpZ2h0OiAxMiwgYm9yZGVyUmFkaXVzOiAnNTAlJywgYmdjb2xvcjogJyNkYzI2MjYnIH19IC8+XHJcbiAgICAgICAgICAgIDxzcGFuPkZsYWdnZWQgLyBhdWRpdCBzcG90bGlnaHQ8L3NwYW4+XHJcbiAgICAgICAgICA8L0JveD5cclxuICAgICAgICAgIDxCb3ggc3g9e3sgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiAwLjUgfX0+XHJcbiAgICAgICAgICAgIDxWaWRlb2NhbUljb24gc3g9e3sgZm9udFNpemU6IDE1LCBjb2xvcjogJyMwZTc0OTAnIH19IC8+XHJcbiAgICAgICAgICAgIDxzcGFuPntjZW50ZXJzLnJlZHVjZSgoc3VtLCBjKSA9PiBzdW0gKyBjLmNhbWVyYV9jb3VudCwgMCl9IGdyb3VuZCBjYW1lcmFzIHJlZ2lzdGVyZWQ8L3NwYW4+XHJcbiAgICAgICAgICA8L0JveD5cclxuICAgICAgICA8L0JveD5cclxuICAgICAgPC9QYXBlcj5cclxuXHJcbiAgICAgIDxHcmlkIGNvbnRhaW5lciBzcGFjaW5nPXszfT5cclxuICAgICAgICA8R3JpZCBpdGVtIHhzPXsxMn0gbGc9ezh9PlxyXG4gICAgICAgICAgPFBhcGVyIHN4PXt7IHA6IDAuNzUsIHBvc2l0aW9uOiAncmVsYXRpdmUnLCBvdmVyZmxvdzogJ2hpZGRlbicgfX0+XHJcbiAgICAgICAgICAgIDxCb3ggcmVmPXttYXBSZWZ9IHN4PXt7IGhlaWdodDogNTYwLCB3aWR0aDogJzEwMCUnLCBib3JkZXJSYWRpdXM6IDEsIGJnY29sb3I6ICcjZThlZWY2JyB9fSAvPlxyXG4gICAgICAgICAgICB7ZW5naW5lID09PSAncGVuZGluZycgJiYgKFxyXG4gICAgICAgICAgICAgIDxCb3hcclxuICAgICAgICAgICAgICAgIHN4PXt7XHJcbiAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLCBpbnNldDogMCwgZGlzcGxheTogJ2ZsZXgnLCBmbGV4RGlyZWN0aW9uOiAnY29sdW1uJyxcclxuICAgICAgICAgICAgICAgICAganVzdGlmeUNvbnRlbnQ6ICdjZW50ZXInLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiAxLjUsIGJnY29sb3I6ICdyZ2JhKDI1NSwyNTUsMjU1LDAuNjUpJyxcclxuICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgPENpcmN1bGFyUHJvZ3Jlc3Mgc2l6ZT17Mjh9IC8+XHJcbiAgICAgICAgICAgICAgICA8VHlwb2dyYXBoeSB2YXJpYW50PVwiY2FwdGlvblwiIGNvbG9yPVwidGV4dC5zZWNvbmRhcnlcIj5Mb2FkaW5nIHRoZSBsaXZlIG1hcOKApjwvVHlwb2dyYXBoeT5cclxuICAgICAgICAgICAgICA8L0JveD5cclxuICAgICAgICAgICAgKX1cclxuICAgICAgICAgIDwvUGFwZXI+XHJcbiAgICAgICAgICA8Qm94IHN4PXt7IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAyLjUsIGZsZXhXcmFwOiAnd3JhcCcsIG10OiAxLjUsIHB4OiAwLjUsIGZvbnRTaXplOiAxMi41LCBjb2xvcjogJyM0NzU1NjknIH19PlxyXG4gICAgICAgICAgICB7T2JqZWN0LmVudHJpZXMoU0NIRU1FX0NPTE9SUykubWFwKChbc2NoZW1lLCBjb2xvcl0pID0+IChcclxuICAgICAgICAgICAgICA8Qm94IGtleT17c2NoZW1lfSBzeD17eyBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBnYXA6IDAuNyB9fT5cclxuICAgICAgICAgICAgICAgIDxCb3ggc3g9e3sgd2lkdGg6IDExLCBoZWlnaHQ6IDExLCBib3JkZXJSYWRpdXM6ICc1MCUnLCBiZ2NvbG9yOiBjb2xvciB9fSAvPlxyXG4gICAgICAgICAgICAgICAgPHNwYW4+e1NDSEVNRV9CQURHRVNbc2NoZW1lXT8ubGFiZWwgfHwgc2NoZW1lfTwvc3Bhbj5cclxuICAgICAgICAgICAgICA8L0JveD5cclxuICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgIDxCb3ggc3g9e3sgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiAwLjcgfX0+XHJcbiAgICAgICAgICAgICAgPExvY2F0aW9uSWNvbiBzeD17eyBmb250U2l6ZTogMTQgfX0gLz5cclxuICAgICAgICAgICAgICA8c3Bhbj5DbGljayBhIGNlbnRlciBwaW4gKG9yIGEgZmFjaWxpdHkgaW4gdGhlIGxpc3QpIHRvIG9wZW4gaXRzIGluLWNoYXJnZSBhbmQgZ3JvdW5kLWxldmVsIENDVFYuPC9zcGFuPlxyXG4gICAgICAgICAgICA8L0JveD5cclxuICAgICAgICAgIDwvQm94PlxyXG4gICAgICAgIDwvR3JpZD5cclxuICAgICAgICA8R3JpZCBpdGVtIHhzPXsxMn0gbGc9ezR9PlxyXG4gICAgICAgICAgPEJveCBzeD17eyBkaXNwbGF5OiAnZmxleCcsIGZsZXhEaXJlY3Rpb246ICdjb2x1bW4nLCBnYXA6IDIgfX0+XHJcbiAgICAgICAgICAgIDxQYXBlciBzeD17eyBwOiAxLjI1LCBvdmVyZmxvdzogJ2F1dG8nLCBtYXhIZWlnaHQ6IDIxMCB9fT5cclxuICAgICAgICAgICAgICA8VHlwb2dyYXBoeSB2YXJpYW50PVwic3VidGl0bGUyXCIgc3g9e3sgcHg6IDAuNSwgbWI6IDEsIGNvbG9yOiAnIzMzNDE1NScgfX0+XHJcbiAgICAgICAgICAgICAgICBNb25pdG9yZWQgRmFjaWxpdGllcyAoe2ZpbHRlcmVkQ2VudGVycy5sZW5ndGh9KVxyXG4gICAgICAgICAgICAgIDwvVHlwb2dyYXBoeT5cclxuICAgICAgICAgICAgICA8U3RhY2sgc3BhY2luZz17MC41fT5cclxuICAgICAgICAgICAgICAgIHtmaWx0ZXJlZENlbnRlcnMubWFwKChjKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHNlbGVjdGVkID0gYWN0aXZlQ2VudGVyPy5pZCA9PT0gYy5pZDtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgICAgICAgICA8Qm94XHJcbiAgICAgICAgICAgICAgICAgICAgICBrZXk9e2MuaWR9XHJcbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRBY3RpdmVJZChjLmlkKX1cclxuICAgICAgICAgICAgICAgICAgICAgIHN4PXt7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnNvcjogJ3BvaW50ZXInLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBweDogMSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHk6IDAuNzUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlclJhZGl1czogMS4yNSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBhbGlnbkl0ZW1zOiAnY2VudGVyJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZ2FwOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBiZ2NvbG9yOiBzZWxlY3RlZCA/ICcjZWZmNmZmJyA6ICd0cmFuc3BhcmVudCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlcjogJzFweCBzb2xpZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlckNvbG9yOiBzZWxlY3RlZCA/ICcjYmZkYmZlJyA6ICd0cmFuc3BhcmVudCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICcmOmhvdmVyJzogeyBiZ2NvbG9yOiAnI2Y4ZmFmYycgfSxcclxuICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPEJveCBzeD17eyB3aWR0aDogMTAsIGhlaWdodDogMTAsIGJvcmRlclJhZGl1czogJzUwJScsIGJnY29sb3I6IGNlbnRlckNvbG9yKGMpLCBmbGV4U2hyaW5rOiAwIH19IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8VHlwb2dyYXBoeSBub1dyYXAgc3g9e3sgZm9udFNpemU6IDEyLjUsIGZvbnRXZWlnaHQ6IHNlbGVjdGVkID8gNzAwIDogNTAwLCBmbGV4R3JvdzogMSB9fSB0aXRsZT17Yy5uYW1lfT5cclxuICAgICAgICAgICAgICAgICAgICAgICAge2MubmFtZX1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvVHlwb2dyYXBoeT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxDaGlwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJzbWFsbFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsPXtgJHtjLmNhbWVyYXNfb25saW5lfS8ke2MuY2FtZXJhX2NvdW50fWB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGljb249ezxWaWRlb2NhbUljb24gc3g9e3sgZm9udFNpemU6IDEzIH19IC8+fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzeD17eyBoZWlnaHQ6IDIwLCBmb250U2l6ZTogMTAuNSwgZmxleFNocmluazogMCB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwib3V0bGluZWRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvcj17Yy5jYW1lcmFzX29ubGluZSA/ICdzdWNjZXNzJyA6ICdkZWZhdWx0J31cclxuICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9Cb3g+XHJcbiAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICB9KX1cclxuICAgICAgICAgICAgICA8L1N0YWNrPlxyXG4gICAgICAgICAgICA8L1BhcGVyPlxyXG5cclxuICAgICAgICAgICAge2FjdGl2ZUNlbnRlciA/IChcclxuICAgICAgICAgICAgICA8UGFwZXIgc3g9e3sgcDogMi4yNSwgb3ZlcmZsb3c6ICdhdXRvJyB9fT5cclxuICAgICAgICAgICAgICAgIDxCb3ggc3g9e3sgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiAxLCBtYjogMSwgZmxleFdyYXA6ICd3cmFwJyB9fT5cclxuICAgICAgICAgICAgICAgICAgPENoaXBcclxuICAgICAgICAgICAgICAgICAgICBzaXplPVwic21hbGxcIlxyXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsPXtTQ0hFTUVfQkFER0VTW2FjdGl2ZUNlbnRlci5zY2hlbWVdPy5sYWJlbCB8fCBhY3RpdmVDZW50ZXIuc2NoZW1lfVxyXG4gICAgICAgICAgICAgICAgICAgIHN4PXt7XHJcbiAgICAgICAgICAgICAgICAgICAgICBiZ2NvbG9yOiBTQ0hFTUVfQkFER0VTW2FjdGl2ZUNlbnRlci5zY2hlbWVdPy5iZyB8fCAnI2YxZjVmOScsXHJcbiAgICAgICAgICAgICAgICAgICAgICBjb2xvcjogU0NIRU1FX0JBREdFU1thY3RpdmVDZW50ZXIuc2NoZW1lXT8uY29sb3IgfHwgJyM0NzU1NjknLFxyXG4gICAgICAgICAgICAgICAgICAgICAgZm9udFdlaWdodDogNzAwLFxyXG4gICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgIDxDaGlwIHNpemU9XCJzbWFsbFwiIGxhYmVsPXthY3RpdmVDZW50ZXIuc3RhdHVzfSBjb2xvcj17c3RhdHVzQ2hpcENvbG9yKGFjdGl2ZUNlbnRlci5zdGF0dXMpfSAvPlxyXG4gICAgICAgICAgICAgICAgPC9Cb3g+XHJcblxyXG4gICAgICAgICAgICAgICAgPFR5cG9ncmFwaHkgdmFyaWFudD1cImg2XCIgc3g9e3sgZm9udFdlaWdodDogNzAwLCBsaW5lSGVpZ2h0OiAxLjMgfX0+XHJcbiAgICAgICAgICAgICAgICAgIHthY3RpdmVDZW50ZXIubmFtZX1cclxuICAgICAgICAgICAgICAgIDwvVHlwb2dyYXBoeT5cclxuICAgICAgICAgICAgICAgIDxUeXBvZ3JhcGh5IHZhcmlhbnQ9XCJjYXB0aW9uXCIgY29sb3I9XCJ0ZXh0LnNlY29uZGFyeVwiIHN4PXt7IGRpc3BsYXk6ICdibG9jaycsIG10OiAwLjUgfX0+XHJcbiAgICAgICAgICAgICAgICAgIPCfk40ge2FjdGl2ZUNlbnRlci5sb2NhdGlvbn1cclxuICAgICAgICAgICAgICAgIDwvVHlwb2dyYXBoeT5cclxuXHJcbiAgICAgICAgICAgICAgICA8RGl2aWRlciBzeD17eyBteTogMS41IH19IC8+XHJcblxyXG4gICAgICAgICAgICAgICAge2FjdGl2ZUNlbnRlci5zdGF0dXMgPT09ICdmbGFnZ2VkJyAmJiAoXHJcbiAgICAgICAgICAgICAgICAgIDxBbGVydCBzZXZlcml0eT1cImVycm9yXCIgc3g9e3sgbWI6IDIgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgPHN0cm9uZz5Eb1NKRSBBdWRpdCBTcG90bGlnaHQ6PC9zdHJvbmc+IHRoaXMgY2VudGVyIGlzIGZsYWdnZWQg4oCUIENDVFYgdGFtcGVyIG9yIGhlYWRjb3VudFxyXG4gICAgICAgICAgICAgICAgICAgIGFub21hbGllcyB3ZXJlIGRldGVjdGVkLiBQaHlzaWNhbGx5IHZlcmlmeSBiZWZvcmUgcmVsZWFzaW5nIGZ1cnRoZXIgZ3JhbnRzLlxyXG4gICAgICAgICAgICAgICAgICA8L0FsZXJ0PlxyXG4gICAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAgICA8Qm94IHN4PXt7IGJnY29sb3I6ICcjZjBmOWZmJywgYm9yZGVyOiAnMXB4IHNvbGlkICNiYWU2ZmQnLCBib3JkZXJSYWRpdXM6IDIsIHA6IDEuNzUsIG1iOiAyIH19PlxyXG4gICAgICAgICAgICAgICAgICA8Qm94IHN4PXt7IGRpc3BsYXk6ICdmbGV4JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIGdhcDogMC43NSwgbWI6IDEgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgPFBlcnNvbkljb24gc3g9e3sgZm9udFNpemU6IDE2LCBjb2xvcjogJyMwMzY5YTEnIH19IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgPFR5cG9ncmFwaHlcclxuICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJjYXB0aW9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgIHN4PXt7IGZvbnRXZWlnaHQ6IDgwMCwgbGV0dGVyU3BhY2luZzogMC42LCBjb2xvcjogJyMwMzY5YTEnLCB0ZXh0VHJhbnNmb3JtOiAndXBwZXJjYXNlJyB9fVxyXG4gICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgIENlbnRlciBIZWFkIC8gSW4tY2hhcmdlXHJcbiAgICAgICAgICAgICAgICAgICAgPC9UeXBvZ3JhcGh5PlxyXG4gICAgICAgICAgICAgICAgICA8L0JveD5cclxuICAgICAgICAgICAgICAgICAge2FjdGl2ZUNlbnRlci5oZWFkID8gKFxyXG4gICAgICAgICAgICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8VHlwb2dyYXBoeSBzeD17eyBmb250V2VpZ2h0OiA3MDAsIGZvbnRTaXplOiAxNSB9fT57YWN0aXZlQ2VudGVyLmhlYWQubmFtZX08L1R5cG9ncmFwaHk+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8VHlwb2dyYXBoeSB2YXJpYW50PVwiYm9keTJcIiBjb2xvcj1cInRleHQuc2Vjb25kYXJ5XCIgc3g9e3sgbWI6IDEgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHthY3RpdmVDZW50ZXIuaGVhZC5kZXNpZ25hdGlvbn1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvVHlwb2dyYXBoeT5cclxuICAgICAgICAgICAgICAgICAgICAgIDxTdGFjayBkaXJlY3Rpb249XCJyb3dcIiBzcGFjaW5nPXsxfSBmbGV4V3JhcD1cIndyYXBcIiB1c2VGbGV4R2FwPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7YWN0aXZlQ2VudGVyLmhlYWQucGhvbmUgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxDaGlwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQ9XCJhXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhyZWY9e2B0ZWw6JHthY3RpdmVDZW50ZXIuaGVhZC5waG9uZX1gfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xpY2thYmxlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaXplPVwic21hbGxcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWNvbj17PFBob25lSWNvbiBzeD17eyBmb250U2l6ZTogMTQgfX0gLz59XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbD17YWN0aXZlQ2VudGVyLmhlYWQucGhvbmV9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwib3V0bGluZWRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHthY3RpdmVDZW50ZXIuaGVhZC5lbWFpbCAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPENoaXBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudD1cImFcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaHJlZj17YG1haWx0bzoke2FjdGl2ZUNlbnRlci5oZWFkLmVtYWlsfWB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGlja2FibGVcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJzbWFsbFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpY29uPXs8RW1haWxJY29uIHN4PXt7IGZvbnRTaXplOiAxNCB9fSAvPn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsPXthY3RpdmVDZW50ZXIuaGVhZC5lbWFpbH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJvdXRsaW5lZFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAge2FjdGl2ZUNlbnRlci5oZWFkLnNpbmNlICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8Q2hpcCBzaXplPVwic21hbGxcIiBsYWJlbD17YEluLWNoYXJnZSBzaW5jZSAke2FjdGl2ZUNlbnRlci5oZWFkLnNpbmNlfWB9IHZhcmlhbnQ9XCJvdXRsaW5lZFwiIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L1N0YWNrPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvPlxyXG4gICAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICAgIDxUeXBvZ3JhcGh5IHZhcmlhbnQ9XCJib2R5MlwiIGNvbG9yPVwidGV4dC5zZWNvbmRhcnlcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIEhlYWQtb2YtY2VudGVyIGRldGFpbHMgYXJlIG5vdCBvbiBmaWxlIGZvciB0aGlzIGZhY2lsaXR5IHlldC5cclxuICAgICAgICAgICAgICAgICAgICA8L1R5cG9ncmFwaHk+XHJcbiAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICA8L0JveD5cclxuXHJcbiAgICAgICAgICAgICAgICA8Qm94IHN4PXt7IGJnY29sb3I6ICcjZjhmYWZjJywgcDogMS41LCBib3JkZXJSYWRpdXM6IDEuNSwgbWI6IDIgfX0+XHJcbiAgICAgICAgICAgICAgICAgIDxHcmlkIGNvbnRhaW5lciBzcGFjaW5nPXsxfSBzeD17eyBmb250U2l6ZTogMTIgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgPEdyaWQgaXRlbSB4cz17Nn0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17eyBjb2xvcjogJyM2NDc0OGInIH19PlNhbmN0aW9uZWQgQnVkZ2V0Ojwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZm9udFdlaWdodDogNzAwIH19PuKCuXsoYWN0aXZlQ2VudGVyLmJ1ZGdldCB8fCAwKS50b0xvY2FsZVN0cmluZygnZW4tSU4nKX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L0dyaWQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPEdyaWQgaXRlbSB4cz17Nn0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17eyBjb2xvcjogJyM2NDc0OGInIH19PlNhbmN0aW9uIENvZGU6PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiA3MDAsIGZvbnRTaXplOiAxMSB9fT57YWN0aXZlQ2VudGVyLnNhbmN0aW9uX2NvZGUgfHwgJ+KAlCd9PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9HcmlkPlxyXG4gICAgICAgICAgICAgICAgICAgIDxHcmlkIGl0ZW0geHM9ezZ9IHN4PXt7IG10OiAxIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3sgY29sb3I6ICcjNjQ3NDhiJyB9fT5TYW5jdGlvbmVkIENhcGFjaXR5Ojwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZm9udFdlaWdodDogNzAwIH19PnthY3RpdmVDZW50ZXIuc2FuY3Rpb25lZF9jYXBhY2l0eSA/PyAn4oCUJ308L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L0dyaWQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPEdyaWQgaXRlbSB4cz17Nn0gc3g9e3sgbXQ6IDEgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17eyBjb2xvcjogJyM2NDc0OGInIH19PlZlcmlmaWVkIEhlYWRjb3VudDo8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDcwMCB9fT57YWN0aXZlQ2VudGVyLnZlcmlmaWVkX2hlYWRjb3VudCA/PyAn4oCUJ308L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L0dyaWQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPEdyaWQgaXRlbSB4cz17Nn0gc3g9e3sgbXQ6IDEgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17eyBjb2xvcjogJyM2NDc0OGInIH19PkFFQkFTIFB1bmNoZXM6PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiA3MDAgfX0+e2FjdGl2ZUNlbnRlci5hZWJhc19wdW5jaF9jb3VudCA/PyAn4oCUJ308L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L0dyaWQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPEdyaWQgaXRlbSB4cz17Nn0gc3g9e3sgbXQ6IDEgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17eyBjb2xvcjogJyM2NDc0OGInIH19PkRpc2NyZXBhbmN5IM6UOjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBmb250V2VpZ2h0OiA3MDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6IChhY3RpdmVDZW50ZXIuZGlzY3JlcGFuY3lfZGVsdGEgfHwgMCkgPiA1ID8gJyNkYzI2MjYnIDogJyMwNTk2NjknLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7YWN0aXZlQ2VudGVyLmRpc2NyZXBhbmN5X2RlbHRhID8/ICfigJQnfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9HcmlkPlxyXG4gICAgICAgICAgICAgICAgICAgIDxHcmlkIGl0ZW0geHM9ezZ9IHN4PXt7IG10OiAxIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3sgY29sb3I6ICcjNjQ3NDhiJyB9fT5OYXZJQyBDb29yZGluYXRlczo8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDcwMCB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAge2FjdGl2ZUNlbnRlci5nZW9fY29vcmRzPy5sYXQgIT0gbnVsbFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgID8gYCR7YWN0aXZlQ2VudGVyLmdlb19jb29yZHMubGF0LnRvRml4ZWQoNCl9wrBOLCAke2FjdGl2ZUNlbnRlci5nZW9fY29vcmRzLmxuZy50b0ZpeGVkKDQpfcKwRWBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA6ICfigJQnfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9HcmlkPlxyXG4gICAgICAgICAgICAgICAgICAgIDxHcmlkIGl0ZW0geHM9ezZ9IHN4PXt7IG10OiAxIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3sgY29sb3I6ICcjNjQ3NDhiJyB9fT5BSSBBbm9tYWx5IFN0YXR1czo8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZm9udFdlaWdodDogNzAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yOiBhY3RpdmVDZW50ZXIuc3RhdHVzID09PSAnZmxhZ2dlZCcgPyAnI2VmNDQ0NCcgOiAnIzA1OTY2OScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHthY3RpdmVDZW50ZXIuc3RhdHVzID09PSAnZmxhZ2dlZCcgPyAnSElHSCBSSVNLIERFVEVDVEVEJyA6ICdOT01JTkFMJ31cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvR3JpZD5cclxuICAgICAgICAgICAgICAgICAgPC9HcmlkPlxyXG4gICAgICAgICAgICAgICAgPC9Cb3g+XHJcblxyXG4gICAgICAgICAgICAgICAgPEJveCBzeD17eyBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBqdXN0aWZ5Q29udGVudDogJ3NwYWNlLWJldHdlZW4nLCBtYjogMSB9fT5cclxuICAgICAgICAgICAgICAgICAgPEJveCBzeD17eyBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBnYXA6IDAuNzUgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgPFZpZGVvY2FtSWNvbiBzeD17eyBmb250U2l6ZTogMTcsIGNvbG9yOiAnIzBlNzQ5MCcgfX0gLz5cclxuICAgICAgICAgICAgICAgICAgICA8VHlwb2dyYXBoeSB2YXJpYW50PVwic3VidGl0bGUyXCIgc3g9e3sgZm9udFdlaWdodDogODAwLCBjb2xvcjogJyMwZTc0OTAnLCBsZXR0ZXJTcGFjaW5nOiAwLjMgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICBHUk9VTkQtTEVWRUwgQ0NUViDCtyBMSVZFXHJcbiAgICAgICAgICAgICAgICAgICAgPC9UeXBvZ3JhcGh5PlxyXG4gICAgICAgICAgICAgICAgICA8L0JveD5cclxuICAgICAgICAgICAgICAgICAgPENoaXBcclxuICAgICAgICAgICAgICAgICAgICBzaXplPVwic21hbGxcIlxyXG4gICAgICAgICAgICAgICAgICAgIGNvbG9yPXtvbmxpbmVDYW1lcmFzID8gJ3N1Y2Nlc3MnIDogJ2RlZmF1bHQnfVxyXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsPXtgJHtvbmxpbmVDYW1lcmFzfS8ke2FjdGl2ZUNhbWVyYXMubGVuZ3RofSBvbmxpbmVgfVxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgPC9Cb3g+XHJcblxyXG4gICAgICAgICAgICAgICAge2FjdGl2ZUNhbWVyYXMubGVuZ3RoID8gKFxyXG4gICAgICAgICAgICAgICAgICA8R3JpZCBjb250YWluZXIgc3BhY2luZz17MS4yNX0gc3g9e3sgbWI6IDIgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAge2FjdGl2ZUNhbWVyYXMubWFwKChjYW0pID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgIDxHcmlkIGl0ZW0geHM9ezEyfSBzbT17Nn0ga2V5PXtjYW0uaWR9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8VG9vbHRpcCB0aXRsZT17Y2FtLmFub21hbHlfbm90ZSB8fCBjYW0ubmFtZX0gYXJyb3c+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPFBhcGVyXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwib3V0bGluZWRcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3g9e3sgb3ZlcmZsb3c6ICdoaWRkZW4nLCBib3JkZXJSYWRpdXM6IDEuNSwgYm9yZGVyQ29sb3I6IGNhbS5vbmxpbmUgPyAnI2JhZTZmZCcgOiAnI2UyZThmMCcgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Qm94IHN4PXt7IHBvc2l0aW9uOiAncmVsYXRpdmUnLCBiZ2NvbG9yOiAnIzBmMTcyYScgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtjYW0ub25saW5lID8gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxCb3hcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudD1cImltZ1wiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmM9e2Ake21vbml0b3JpbmdBUEkuc25hcHNob3RVcmwoY2FtLmlkKX0mZnJhbWU9JHt0aWNrfWB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbHQ9e2NhbS5uYW1lfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3g9e3sgZGlzcGxheTogJ2Jsb2NrJywgd2lkdGg6ICcxMDAlJywgaGVpZ2h0OiAxMDgsIG9iamVjdEZpdDogJ2NvdmVyJyB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPEJveFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3g9e3tcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiAxMDgsIGRpc3BsYXk6ICdmbGV4JywgZmxleERpcmVjdGlvbjogJ2NvbHVtbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsaWduSXRlbXM6ICdjZW50ZXInLCBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsIGNvbG9yOiAnIzk0YTNiOCcsIGdhcDogMC41LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8V2FybmluZ0ljb24gc3g9e3sgZm9udFNpemU6IDIyIH19IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8VHlwb2dyYXBoeSB2YXJpYW50PVwiY2FwdGlvblwiPkZlZWQgb2ZmbGluZTwvVHlwb2dyYXBoeT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L0JveD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPENoaXBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbD17Y2FtLm9ubGluZSA/ICfil48gTElWRScgOiAnT0ZGTElORSd9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT1cInNtYWxsXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvcj17Y2FtLm9ubGluZSA/ICdzdWNjZXNzJyA6ICdkZWZhdWx0J31cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzeD17eyBwb3NpdGlvbjogJ2Fic29sdXRlJywgdG9wOiA2LCBsZWZ0OiA2LCBoZWlnaHQ6IDE5LCBmb250U2l6ZTogMTAsIGZvbnRXZWlnaHQ6IDgwMCB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Y2FtLnRhbXBlcl9mbGFnICYmIGNhbS50YW1wZXJfZmxhZyAhPT0gJ25vcm1hbCcgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxDaGlwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbD17Y2FtLnRhbXBlcl9mbGFnLnJlcGxhY2UoL18vZywgJyAnKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJzbWFsbFwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvcj1cImVycm9yXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN4PXt7IHBvc2l0aW9uOiAnYWJzb2x1dGUnLCB0b3A6IDYsIHJpZ2h0OiA2LCBoZWlnaHQ6IDE5LCBmb250U2l6ZTogMTAsIGZvbnRXZWlnaHQ6IDcwMCB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L0JveD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxCb3ggc3g9e3sgcHg6IDEsIHB5OiAwLjc1IH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8VHlwb2dyYXBoeSBub1dyYXAgc3g9e3sgZm9udFNpemU6IDExLjUsIGZvbnRXZWlnaHQ6IDcwMCB9fSB0aXRsZT17Y2FtLm5hbWV9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtjYW0ubmFtZX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9UeXBvZ3JhcGh5PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8VHlwb2dyYXBoeSBub1dyYXAgdmFyaWFudD1cImNhcHRpb25cIiBjb2xvcj1cInRleHQuc2Vjb25kYXJ5XCIgdGl0bGU9e2NhbS5sb2NhdGlvbn0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2NhbS5sb2NhdGlvbn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9UeXBvZ3JhcGh5PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7Y2FtLmRldGVjdGVkX2hlYWRjb3VudCAhPSBudWxsICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8VHlwb2dyYXBoeVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudD1cImNhcHRpb25cIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3g9e3tcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzcGxheTogJ2Jsb2NrJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6IGNhbS5kZXRlY3RlZF9oZWFkY291bnQgPT09IGNhbS5hZWJhc19wdW5jaF9jb3VudCA/ICcjMDU5NjY5JyA6ICcjZGMyNjI2JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQUkgaGVhZGNvdW50IHtjYW0uZGV0ZWN0ZWRfaGVhZGNvdW50fSDCtyBBRUJBUyB7Y2FtLmFlYmFzX3B1bmNoX2NvdW50fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvVHlwb2dyYXBoeT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvQm94PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvUGFwZXI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvVG9vbHRpcD5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvR3JpZD5cclxuICAgICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgICAgPC9HcmlkPlxyXG4gICAgICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICAgICAgPEFsZXJ0IHNldmVyaXR5PVwiaW5mb1wiIHN4PXt7IG1iOiAyIH19PlxyXG4gICAgICAgICAgICAgICAgICAgIE5vIGdyb3VuZC1sZXZlbCBjYW1lcmFzIHJlZ2lzdGVyZWQgZm9yIHRoaXMgY2VudGVyIHlldC5cclxuICAgICAgICAgICAgICAgICAgPC9BbGVydD5cclxuICAgICAgICAgICAgICAgICl9XHJcblxyXG4gICAgICAgICAgICAgICAgPFN0YWNrIGRpcmVjdGlvbj1cInJvd1wiIHNwYWNpbmc9ezF9IGZsZXhXcmFwPVwid3JhcFwiIHVzZUZsZXhHYXA+XHJcbiAgICAgICAgICAgICAgICAgIDxCdXR0b25cclxuICAgICAgICAgICAgICAgICAgICBzaXplPVwic21hbGxcIlxyXG4gICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJjb250YWluZWRcIlxyXG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0SWNvbj17PFZpZGVvY2FtSWNvbiAvPn1cclxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBuYXZpZ2F0ZSgnL2xpdmUnKX1cclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIExpdmUgQ0NUViBXYWxsXHJcbiAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICA8QnV0dG9uIHNpemU9XCJzbWFsbFwiIHZhcmlhbnQ9XCJvdXRsaW5lZFwiIG9uQ2xpY2s9eygpID0+IG5hdmlnYXRlKCcvaW5zcGVjdGlvbnMnKX0+XHJcbiAgICAgICAgICAgICAgICAgICAgSW5zcGVjdGlvbiBSZWNvcmRzXHJcbiAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICA8QnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgc2l6ZT1cInNtYWxsXCJcclxuICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwib3V0bGluZWRcIlxyXG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0SWNvbj17PFNoaWVsZEljb24gLz59XHJcbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gbmF2aWdhdGUoJy9hdHInKX1cclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIERpZ2l0YWwgQVRSXHJcbiAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPC9TdGFjaz5cclxuICAgICAgICAgICAgICA8L1BhcGVyPlxyXG4gICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgIDxQYXBlciBzeD17eyBwOiAzLCB0ZXh0QWxpZ246ICdjZW50ZXInLCBjb2xvcjogJyM2NDc0OGInIH19PlxyXG4gICAgICAgICAgICAgICAgU2VsZWN0IGEgZmFjaWxpdHkgb24gdGhlIG1hcCB0byBpbnNwZWN0IGl0cyBjZW50ZXIgaGVhZCBhbmQgZ3JvdW5kLWxldmVsIENDVFYgY2FtZXJhcy5cclxuICAgICAgICAgICAgICA8L1BhcGVyPlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgPC9Cb3g+XHJcbiAgICAgICAgPC9HcmlkPlxyXG4gICAgICA8L0dyaWQ+XHJcbiAgICA8L0JveD5cclxuICApO1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgR0lTTWFwO1xyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcbiJdLCJmaWxlIjoiQzovVXNlcnMvcHJlbWEvRG93bmxvYWRzL1Byb3RvdHlwZS9zYW1hai1kcmlzaHRpL2FkbWluL3NyYy9wYWdlcy9HSVNNYXAuanN4In0=