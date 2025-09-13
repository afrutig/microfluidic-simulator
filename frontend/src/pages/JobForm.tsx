import {
  Button,
  Divider,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { createJob, type JobSpec } from "../api/client";
import GeometrySketch from "../components/GeometrySketch";

export default function JobForm() {
  const nav = useNavigate();
  const [form, setForm] = useState<JobSpec>({
    name: "Demo Job",
    geometry: { width: 1e-3, height: 1e-4 },
    material: { density: 1000, viscosity: 1e-3, diffusivity: 1e-9 },
    boundaries: [
      { type: "inlet", value: 1e-3 },
      { type: "outlet", value: 0 },
      { type: "wall" },
    ],
    solve_transport: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: Record<string, string> = {};
    if (form.geometry.width <= 0) errs.width = "Width must be > 0";
    if (form.geometry.height <= 0) errs.height = "Height must be > 0";
    if (form.material.density <= 0) errs.density = "Density must be > 0";
    if (form.material.viscosity <= 0) errs.viscosity = "Viscosity must be > 0";
    if (form.material.diffusivity <= 0)
      errs.diffusivity = "Diffusivity must be > 0";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      const payload: any = {
        ...form,
        geometry_json: {
          unit: "m",
          shapes: [
            {
              id: "rect1",
              type: "rect",
              x: 0,
              y: 0,
              width: form.geometry.width,
              height: form.geometry.height,
            },
          ],
        },
      };
      const status = await createJob(payload);
      try {
        const { addHistory } = await import("../storage");
        addHistory({
          id: status.id,
          name: form.name,
          createdAt: new Date().toISOString(),
        });
      } catch {}
      nav(`/jobs/${status.id}`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to submit job");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper component="form" onSubmit={onSubmit} sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Typography variant="h6">New Simulation</Typography>
        <TextField
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          fullWidth
        />

        <Divider textAlign="left">Geometry (m)</Divider>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              type="number"
              label="Width (m)"
              value={form.geometry.width}
              onChange={(e) =>
                setForm({
                  ...form,
                  geometry: { ...form.geometry, width: Number(e.target.value) },
                })
              }
              inputProps={{ step: "any", min: 0 }}
              fullWidth
              required
              error={!!errors.width}
              helperText={errors.width}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              type="number"
              label="Height (m)"
              value={form.geometry.height}
              onChange={(e) =>
                setForm({
                  ...form,
                  geometry: {
                    ...form.geometry,
                    height: Number(e.target.value),
                  },
                })
              }
              inputProps={{ step: "any", min: 0 }}
              fullWidth
              required
              error={!!errors.height}
              helperText={errors.height}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <GeometrySketch
              width={form.geometry.width}
              height={form.geometry.height}
            />
          </Grid>
        </Grid>

        <Divider textAlign="left">Material</Divider>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              type="number"
              label="Density (kg/m³)"
              value={form.material.density}
              onChange={(e) =>
                setForm({
                  ...form,
                  material: {
                    ...form.material,
                    density: Number(e.target.value),
                  },
                })
              }
              inputProps={{ step: "any", min: 0 }}
              fullWidth
              required
              error={!!errors.density}
              helperText={errors.density}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              type="number"
              label="Viscosity (Pa·s)"
              value={form.material.viscosity}
              onChange={(e) =>
                setForm({
                  ...form,
                  material: {
                    ...form.material,
                    viscosity: Number(e.target.value),
                  },
                })
              }
              inputProps={{ step: "any", min: 0 }}
              fullWidth
              required
              error={!!errors.viscosity}
              helperText={errors.viscosity}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              type="number"
              label="Diffusivity (m²/s)"
              value={form.material.diffusivity}
              onChange={(e) =>
                setForm({
                  ...form,
                  material: {
                    ...form.material,
                    diffusivity: Number(e.target.value),
                  },
                })
              }
              inputProps={{ step: "any", min: 0 }}
              fullWidth
              required
              error={!!errors.diffusivity}
              helperText={errors.diffusivity}
            />
          </Grid>
        </Grid>

        <FormControlLabel
          control={
            <Switch
              checked={!!form.solve_transport}
              onChange={(e) =>
                setForm({ ...form, solve_transport: e.target.checked })
              }
            />
          }
          label="Solve species transport"
        />

        {error && <Typography color="error">{error}</Typography>}
        <Button type="submit" variant="contained" disabled={loading}>
          {loading ? "Submitting…" : "Submit Job"}
        </Button>
      </Stack>
    </Paper>
  );
}
