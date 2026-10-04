# Samaj Drishti Mobile Field Inspection App

**Installable PWA for Field Officers** | Smart Automation Hackathon 2026 | PS-26095

## Overview

The mobile-web app is a Progressive Web App (PWA) designed for field inspection officers to conduct geo-tagged inspections, capture evidence, and perform remote verification.

## Features

- 📱 **Installable PWA** - Works on Android/iOS/desktop without app store
- 🌐 **Offline-First** - Full functionality when offline, syncs when connected
- 📍 **Geo-Verification** - GPS coordinates with configurable geofencing
- 📷 **Evidence Capture** - Photos, videos, documents with integrity watermarking
- 💬 **Video Verification** - Real-time random video calls for surprise checks
- 👥 **Beneficiary Sampling** - Random selection for independent verification
- 🤖 **AI Assistant** - Anomaly detection and risk scoring
- 📋 **Checklist System** - 24-point inspection checklist

## Installation

### Development

```bash
cd mobile-web
npm install
npm run dev
```

The PWA will be available at `http://localhost:5174`

### Production Build

```bash
npm run build
npm run preview
```

## PWA Installation

On mobile devices:
1. Open the app in Chrome/Firefox/Safari
2. Tap the "Add to Home Screen" prompt, or use browser menu
3. Access like any native app from your device's home screen

### Adding to Home Screen (iOS Safari)

1. Tap the Share button
2. Scroll down and tap "Add to Home Screen"
3. Tap "Add" in the top right

### Adding to Home Screen (Android Chrome)

1. Tap the three-dot menu
2. Tap "Install app" or "Add to Home screen"
3. Tap "Add"

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:5000` | Backend API URL |
| `VITE_GIS_KEY` | - | Google Maps API key (optional) |

Runtime override via `public/config.js`:
```javascript
window.__APP_CONFIG__ = {
  API_URL: 'https://your-backend.example.com'
};
```

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `POST /auth/login` | User authentication |
| `GET /inspections/mine` | Assigned inspections |
| `POST /evidence` | Upload evidence |
| `GET /anomalies` | AI anomaly detection |
| `GET /vc/sessions` | Video verification sessions |
| `GET /monitoring/cameras` | Live CCTV feeds |

## Data Storage

- **Session Storage**: `si_session_v1` - Current inspection session
- **Offline Queue**: `si_simulated_offline` - Offline mode toggle
- **Authentication**: `sd_token`, `sd_user` - JWT token and user data

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Field Officer | official1@samajdrishti.gov.in | Official@123 |
| PMU Officer | supervisor@samajdrishti.gov.in | Super@123 |
| Admin | admin@samajdrishti.gov.in | Admin@123 |

## Project Structure

```
mobile-web/
├── public/
│   ├── manifest.webmanifest  # PWA manifest
│   ├── sw.js                 # Service worker
│   └── config.js             # Runtime config override
├── src/
│   ├── screens/              # Page components
│   ├── components/           # Reusable UI components
│   ├── context/              # React contexts (Auth, Inspection)
│   ├── services/             # API clients and utilities
│   └── App.jsx               # Router and layout
├── package.json
└── vite.config.js
```

## Responsive Design

The app is optimized for:
- Mobile phones (portrait/landscape)
- Tablets (split-screen capable)
- Desktop browsers (keyboard navigation)

## Accessibility

- Screen reader support (ARIA labels)
- Keyboard navigation
- High contrast mode (system preference)
- Reduced motion support

## Offline Capability

The PWA uses a service worker with:
- Cache-first strategy for static assets
- Network-first for API calls (with fallback)
- Background sync for evidence uploads

## Building for Production

### Docker

```bash
docker build -t samajdrishti/mobile .
```

### Deploy to Vercel/Netlify

```bash
npm run build
# Deploy the 'dist' folder
```

## Troubleshooting

**App not installing?**
- Ensure served over HTTPS
- Check `manifest.webmanifest` is accessible
- Verify service worker is registered

**Offline mode not working?**
- Check browser's dev tools > Application > Service Workers
- Verify IndexedDB is enabled

**GPS not working?**
- Ensure browser permissions for location
- Try in incognito mode to check for conflicts

## License

MIT - Government of India Digital Monitoring Initiative