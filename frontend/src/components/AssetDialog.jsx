import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import api, { ASSETS } from '../api/axios';

const SECTION_OPTIONS = ['PYRJ-MIU', 'PYRJ-ALD', 'ALD-MZP'];
const ASSET_TYPES = ['track', 'signal', 'traction'];
const LINE_CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'DFC', 'suburban'];
const DENSITY_CLASSES = ['A', 'B', 'C', 'D', 'E'];

const DEFAULT_FORM_VALUES = {
  asset_type: 'track',
  sub_type: '',
  division_code: 'NCR',
  section_code: 'PYRJ-ALD',
  corridor_id: 'HWH-NDLS_MAIN',
  km_start: '',
  km_end: '',
  line_category: 'A',
  traffic_density_class: 'A',
};

/**
 * AssetDialog Component for Creating and Editing Assets
 *
 * Requirements:
 * - Material-UI Dialog component
 * - Form fields:
 *   * asset_type (select: track, signal, traction)
 *   * sub_type (text field)
 *   * division_code (text field, default: "NCR")
 *   * section_code (select: PYRJ-MIU, PYRJ-ALD, ALD-MZP)
 *   * corridor_id (text field, default: "HWH-NDLS_MAIN")
 *   * km_start (number field)
 *   * km_end (number field)
 *   * line_category (select: A, B, C, D, E, DFC, suburban)
 *   * traffic_density_class (select: A, B, C, D, E)
 * - Validation (required fields)
 * - Submit button (POST /assets or PUT /assets/:id)
 * - Cancel button
 * - Close on submit
 * - Show success/error message
 */
export default function AssetDialog({
  open,
  onClose,
  onSuccess,
  asset = null, // If provided, edit mode is activated
}) {
  const isEditMode = Boolean(asset && asset.asset_id);

  const [formData, setFormData] = useState(DEFAULT_FORM_VALUES);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Sync form values when dialog opens or asset prop changes
  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      if (asset) {
        setFormData({
          asset_type: asset.asset_type || 'track',
          sub_type: asset.sub_type || '',
          division_code: asset.division_code || 'NCR',
          section_code: asset.section_code || 'PYRJ-ALD',
          corridor_id: asset.corridor_id || 'HWH-NDLS_MAIN',
          km_start: asset.km_start !== undefined ? String(asset.km_start) : '',
          km_end: asset.km_end !== undefined ? String(asset.km_end) : '',
          line_category: asset.line_category || 'A',
          traffic_density_class: asset.traffic_density_class || 'A',
        });
      } else {
        setFormData(DEFAULT_FORM_VALUES);
      }
    }
  }, [open, asset]);

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
    if (errorMessage) setErrorMessage(null);
  };

  // Form validation
  const validateForm = () => {
    if (!formData.asset_type) return 'Asset Type is required.';
    if (!formData.sub_type.trim()) return 'Sub Type is required.';
    if (!formData.division_code.trim()) return 'Division Code is required.';
    if (!formData.section_code) return 'Section Code is required.';
    if (!formData.corridor_id.trim()) return 'Corridor ID is required.';

    if (formData.km_start === '' || isNaN(Number(formData.km_start))) {
      return 'Valid KM Start Chainage is required.';
    }
    if (formData.km_end === '' || isNaN(Number(formData.km_end))) {
      return 'Valid KM End Chainage is required.';
    }

    const start = Number(formData.km_start);
    const end = Number(formData.km_end);

    if (start < 0) {
      return 'KM Start cannot be negative.';
    }
    if (end < start) {
      return 'KM End must be greater than or equal to KM Start.';
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const payload = {
      asset_type: formData.asset_type,
      sub_type: formData.sub_type.trim(),
      division_code: formData.division_code.trim(),
      section_code: formData.section_code,
      corridor_id: formData.corridor_id.trim(),
      km_start: Number(formData.km_start),
      km_end: Number(formData.km_end),
      line_category: formData.line_category,
      traffic_density_class: formData.traffic_density_class,
    };

    try {
      if (isEditMode) {
        await api.put(`${ASSETS}/${asset.asset_id}`, payload);
        if (onSuccess) {
          onSuccess(`Asset #AST-${asset.asset_id} updated successfully!`);
        }
      } else {
        const res = await api.post(ASSETS, payload);
        const newId = res.data?.asset_id ? `#AST-${res.data.asset_id}` : '';
        if (onSuccess) {
          onSuccess(`New asset ${newId} created successfully!`);
        }
      }
      onClose();
    } catch (err) {
      console.error('Asset submission failed:', err);
      const message =
        err.response?.data?.detail ||
        err.message ||
        'Failed to save asset. Please check the entered parameters.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  // Ensure current section is an available option even if from external data
  const availableSections = Array.from(
    new Set([...SECTION_OPTIONS, formData.section_code].filter(Boolean))
  );

  return (
    <Dialog
      open={open}
      onClose={!loading ? onClose : undefined}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        {isEditMode ? (
          <>
            <EditIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Edit Railway Asset #AST-{asset?.asset_id}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Update corridor chainage and classification specifications
              </Typography>
            </Box>
          </>
        ) : (
          <>
            <AddIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Register New Railway Asset
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Register a monitored track, signaling, or traction asset into inventory
              </Typography>
            </Box>
          </>
        )}
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          )}

          <Grid container spacing={2.5}>
            {/* Asset Type */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                fullWidth
                label="Asset Type"
                value={formData.asset_type}
                onChange={handleChange('asset_type')}
                required
              >
                {ASSET_TYPES.map((type) => (
                  <MenuItem key={type} value={type} sx={{ textTransform: 'capitalize' }}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Sub Type */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Sub Type"
                placeholder="e.g. Continuous Welded Rail, Point Machine, OHE Mast"
                value={formData.sub_type}
                onChange={handleChange('sub_type')}
                required
              />
            </Grid>

            {/* Division Code (default: NCR) */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Division Code"
                value={formData.division_code}
                onChange={handleChange('division_code')}
                required
                helperText="Operating Railway Division"
              />
            </Grid>

            {/* Section Code (select: PYRJ-MIU, PYRJ-ALD, ALD-MZP) */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                fullWidth
                label="Section Code"
                value={formData.section_code}
                onChange={handleChange('section_code')}
                required
                helperText="Selected block section"
              >
                {availableSections.map((sec) => (
                  <MenuItem key={sec} value={sec}>
                    {sec}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Corridor ID (default: HWH-NDLS_MAIN) */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Corridor ID"
                value={formData.corridor_id}
                onChange={handleChange('corridor_id')}
                required
                helperText="Grand Trunk / Main corridor identifier"
              />
            </Grid>

            {/* KM Start */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                inputProps={{ step: '0.001', min: '0' }}
                label="KM Start Chainage"
                value={formData.km_start}
                onChange={handleChange('km_start')}
                required
                placeholder="e.g. 10.000"
              />
            </Grid>

            {/* KM End */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                type="number"
                inputProps={{ step: '0.001', min: '0' }}
                label="KM End Chainage"
                value={formData.km_end}
                onChange={handleChange('km_end')}
                required
                placeholder="e.g. 12.500"
              />
            </Grid>

            {/* Line Category (select: A, B, C, D, E, DFC, suburban) */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                fullWidth
                label="Line Category"
                value={formData.line_category}
                onChange={handleChange('line_category')}
                required
              >
                {LINE_CATEGORIES.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    Category {cat}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Traffic Density Class (select: A, B, C, D, E) */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                fullWidth
                label="Traffic Density Class"
                value={formData.traffic_density_class}
                onChange={handleChange('traffic_density_class')}
                required
              >
                {DENSITY_CLASSES.map((cls) => (
                  <MenuItem key={cls} value={cls}>
                    Class {cls} (Density)
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions
          sx={{
            p: 2.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1.5,
          }}
        >
          <Button
            onClick={onClose}
            disabled={loading}
            color="inherit"
            sx={{ fontWeight: 600 }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
            sx={{ fontWeight: 700, minWidth: 130 }}
          >
            {loading ? 'Saving...' : isEditMode ? 'Update Asset' : 'Submit Asset'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
