#!/bin/sh
# Generates /usr/share/nginx/html/config.js at CONTAINER STARTUP so the backend
# URL can be changed without rebuilding the image:
#   docker run -e API_URL=https://api.example.gov.in/api ...
# Precedence: $API_URL > $VITE_API_URL > build-time default (localhost).
set -eu
API_URL_VALUE="${API_URL:-${VITE_API_URL:-http://localhost:5000/api}}"
# Escape single quotes for safe embedding in a JS string.
ESCAPED=$(printf '%s' "$API_URL_VALUE" | sed "s/'/'\\\\''/g")
printf "window.__APP_CONFIG__ = Object.assign(window.__APP_CONFIG__ || {}, { API_URL: '%s' });\n" "$ESCAPED" \
  > /usr/share/nginx/html/config.js
echo "[entrypoint] API_URL=${API_URL_VALUE}"
exec nginx -g 'daemon off;'
