// Runtime backend URL override. This file is OVERWRITTEN at container startup
// by docker-entrypoint.sh from $API_URL (fallback: $VITE_API_URL, then LAN default).
// Local `npm run dev` never reads this file — it uses import.meta.env.VITE_API_URL.
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {};
