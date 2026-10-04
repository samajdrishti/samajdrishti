import React from 'react';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Divider,
  Typography, Button, Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  VideocamOutlined,
  AssignmentOutlined as AssignmentsIcon,
  FactCheckOutlined as FactCheckIcon,
  DescriptionOutlined,
  Gavel as GavelIcon,
  AccessTime,
  PhotoCamera as PhotoIcon,
  Psychology as PsychologyIcon,
  People as PeopleIcon,
  ManageSearch as AuditIcon,
  BusinessOutlined as BusinessIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Map as MapIcon, ShieldOutlined as ShieldIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

// The 12 primary command-desk modules fixed by the PS-26095 product scope.
const menuItems = [
  { text: 'Command Center', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'GIS Compliance Map', icon: <MapIcon />, path: '/gis-map' },
  { text: 'Live CCTV Monitoring', icon: <VideocamOutlined />, path: '/live' },
  { text: 'Field Inspection Procedure', icon: <FactCheckIcon />, path: '/procedure' },
  { text: 'Field Inspections', icon: <AssignmentsIcon />, path: '/inspections' },
  { text: 'Pending Inspection Status', icon: <DescriptionOutlined />, path: '/reports' },
  { text: 'Digital ATRs', icon: <GavelIcon />, path: '/atr' },
  { text: 'Attendance Logs', icon: <AccessTime />, path: '/attendance' },
  { text: 'Tamper-Evidence Vault', icon: <PhotoIcon />, path: '/evidence' },
  { text: 'AI Anomaly & Random Assigner', icon: <PsychologyIcon />, path: '/ai-insights' },
  { text: 'Users & Roles', icon: <PeopleIcon />, path: '/users' },
  { text: 'Audit Logs', icon: <AuditIcon />, path: '/audit-logs' },
];

// Supporting modules kept out of the 12-item desk but still reachable.
const footerLinks = [
  { text: 'Monitored Facilities', icon: <BusinessIcon />, path: '/projects' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const roleColors = { admin: 'error', supervisor: 'warning', official: 'info' };

const Sidebar = ({ user, onLogout, mobile = false, open = false, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isSelected = (path) =>
    location.pathname === path ||
    (path === '/inspections' && location.pathname.startsWith('/inspections/'));

  return (
    <Drawer
      variant={mobile ? 'temporary' : 'permanent'}
      open={mobile ? open : true}
      onClose={onClose}
      sx={{
        width: 250,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 250,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: '#101828',
          color: '#dbe7f5',
        },
      }}
    >
      <Toolbar sx={{ flexDirection: 'column', alignItems: 'stretch', p: '0 8px', minHeight: 72 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, my: 'auto' }}>
          <ShieldIcon sx={{ fontSize: 28, color: '#84adff' }} />
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 15.5, color: '#fff', letterSpacing: 0.2 }}>
              Samaj Drishti
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: '#8fb3dc', letterSpacing: 0.4, textTransform: 'uppercase' }}>
              National Monitoring<br />Command Center
            </Typography>
          </Box>
        </Box>
      </Toolbar>
      <Divider sx={{ borderColor: '#1e3a63' }} />
      <Box sx={{ overflow: 'auto', mt: 1.5, flexGrow: 1, px: 1 }}>
        <List dense>
          {menuItems.map((item) => (
            <ListItemButton
              key={item.path}
              onClick={() => { navigate(item.path); onClose?.(); }}
              selected={isSelected(item.path)}
              sx={{
                borderRadius: 1.5,
                my: 0.25,
                color: '#dbe7f5',
                '&:hover': { bgcolor: 'rgba(91, 150, 216, 0.18)' },
                '&.Mui-selected': {
                  bgcolor: 'rgba(56, 130, 246, 0.28)',
                  color: '#fff',
                  '&:hover': { bgcolor: 'rgba(56, 130, 246, 0.36)' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: 13, fontWeight: location.pathname === item.path || isSelected(item.path) ? 700 : 500 }} />
            </ListItemButton>
          ))}
        </List>

        <Divider sx={{ borderColor: '#1e3a63', my: 1 }} />
        <List dense>
          {footerLinks.map((item) => (
            <ListItemButton
              key={item.path}
              onClick={() => { navigate(item.path); onClose?.(); }}
              selected={location.pathname === item.path}
              sx={{ borderRadius: 1.5, my: 0.25, color: '#bcd0e8', '&:hover': { bgcolor: 'rgba(91, 150, 216, 0.18)' } }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: 13 }} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Divider sx={{ borderColor: '#1e3a63' }} />
      <Box sx={{ p: 1.5 }}>
        {user && (
          <Box sx={{ mb: 1, px: 0.5 }}>
            <Typography variant="subtitle2" noWrap sx={{ color: '#fff' }} title={user.name}>
              {user.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#8fb3dc' }} noWrap display="block">
              {user.email}
            </Typography>
            <Chip
              label={user.role}
              size="small"
              color={roleColors[user.role] || 'default'}
              sx={{ mt: 0.5, textTransform: 'capitalize', height: 20, fontSize: 11 }}
            />
          </Box>
        )}
        <Button
          fullWidth
          size="small"
          color="inherit"
          startIcon={<LogoutIcon />}
          onClick={onLogout}
          sx={{ color: '#dbe7f5', textTransform: 'none' }}
        >
          Sign out
        </Button>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
