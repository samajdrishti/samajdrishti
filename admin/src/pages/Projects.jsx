import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Chip, Alert, MenuItem,
} from '@mui/material';
import { adminAPI } from '../services/api';

const DEPARTMENTS = [
  { value: 'public_works', label: 'Public Works' },
  { value: 'education', label: 'Education' },
  { value: 'health', label: 'Health' },
  { value: 'social_welfare', label: 'Social Welfare' },
  { value: 'urban_development', label: 'Urban Development' },
];

const EMPTY_FORM = {
  name: '', description: '', location: '',
  department: 'public_works', budget: '', start_date: '', end_date: '',
};

const statusColor = { active: 'success', completed: 'info', pending: 'warning' };
const inr = (value) => (value ? `₹${Number(value).toLocaleString('en-IN')}` : '-');

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminAPI.getProjects()
      .then((res) => {
        setProjects(res.data);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.message || err.message || 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.location) {
      setError('Project name and location are required.');
      return;
    }

    setSaving(true);
    try {
      await adminAPI.createProject({
        ...formData,
        budget: formData.budget === '' ? null : Number(formData.budget),
      });
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
      setError('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Projects</Typography>
        <Button variant="contained" onClick={() => setDialogOpen(true)}>Add Project</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Budget</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.id}</TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">{p.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {p.description ? `${p.description.substring(0, 70)}...` : 'No description'}
                  </Typography>
                </TableCell>
                <TableCell>{String(p.department || '-').replace('_', ' ')}</TableCell>
                <TableCell>{p.location || '-'}</TableCell>
                <TableCell>{inr(p.budget)}</TableCell>
                <TableCell>
                  <Chip label={p.status || 'pending'} size="small" color={statusColor[p.status] || 'default'} />
                </TableCell>
              </TableRow>
            ))}
            {!projects.length && !loading && (
              <TableRow>
                <TableCell colSpan={6}>No projects found. Use "Add Project" to register one.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add New Project</DialogTitle>
        <DialogContent>
          <TextField
            label="Name" fullWidth margin="dense" required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            label="Description" fullWidth margin="dense" multiline minRows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <TextField
            label="Location" fullWidth margin="dense" required
            helperText="Keywords such as 'remote', 'rural', 'border' or 'hill' raise the AI risk score."
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
          <TextField
            label="Department" fullWidth margin="dense" select
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          >
            {DEPARTMENTS.map((d) => (
              <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Budget (₹)" fullWidth margin="dense" type="number"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
          />
          <TextField
            label="Start date" fullWidth margin="dense" type="date"
            InputLabelProps={{ shrink: true }}
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
          />
          <TextField
            label="End date" fullWidth margin="dense" type="date"
            InputLabelProps={{ shrink: true }}
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={saving}>
            {saving ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Projects;
