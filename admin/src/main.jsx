import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import App from './App';
import './styles/index.css';

const theme = createTheme({
  palette: {
    primary: { main: '#155eef', dark: '#1246b8', light: '#eaf1ff' },
    secondary: { main: '#475467' },
    success: { main: '#078a67' },
    warning: { main: '#c97900' },
    error: { main: '#d92d20' },
    background: { default: '#f6f8fb', paper: '#ffffff' },
    text: { primary: '#101828', secondary: '#667085' },
  },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontWeight: 750, letterSpacing: '-0.02em' },
    h6: { fontWeight: 700, letterSpacing: '-0.01em' },
    button: { fontWeight: 650, textTransform: 'none' },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', border: '1px solid #eaecf0', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)' } } },
    MuiCard: { styleOverrides: { root: { backgroundImage: 'none', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)' } } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
