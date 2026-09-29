import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import App from './App';
import './styles/index.css';

const theme = createTheme({
  palette: {
    primary: { main: '#2c3e50' },
    secondary: { main: '#3498db' },
    success: { main: '#27ae60' },
    warning: { main: '#f39c12' },
    error: { main: '#e74c3c' },
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
