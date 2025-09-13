import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import {
  BASE_URL,
  createProject,
  getProject as apiGetProject,
  listProjects,
} from "../api/client";
import { useSnackbar } from "../ui/SnackbarProvider";

type ShapeType = "rect" | "inlet" | "outlet";

type Shape = {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Editor() {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOff, setDragOff] = useState<{ dx: number; dy: number } | null>(
    null,
  );
  const [resizeId, setResizeId] = useState<string | null>(null);
  const { notify } = useSnackbar();
  const [unit, setUnit] = useState<"um" | "mm" | "m">("um");
  const unitScale = unit === "um" ? 1 : unit === "mm" ? 1000 : 1_000_000;
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [newProjectName, setNewProjectName] = useState("My Project");
  const location = useLocation();
  const [history, setHistory] = useState<
    { shapes: Shape[]; unit: typeof unit }[]
  >([]);
  const [histIdx, setHistIdx] = useState(-1);
  // DXF import mapping dialog state
  const [dxfDialogOpen, setDxfDialogOpen] = useState(false);
  const [dxfFile, setDxfFile] = useState<File | null>(null);
  const [dxfLayers, setDxfLayers] = useState<string[]>([]);
  const [layerWidths, setLayerWidths] = useState<Record<string, number>>({});
  const [layerTypes, setLayerTypes] = useState<Record<string, string>>({});
  const [inletU, setInletU] = useState(1e-3); // m/s

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pid = params.get("project");
    // if openProjectData is set (from projects page), load it
    const raw = sessionStorage.getItem("openProjectData");
    if (raw) {
      try {
        const proj = JSON.parse(raw);
        const data = proj.data || {};
        if (Array.isArray(data.shapes))
          setShapes(data.shapes.map((d: any) => ({ ...d, id: uid() })));
        if (data.unit) setUnit(data.unit);
      } catch {}
      sessionStorage.removeItem("openProjectData");
    }
  }, [location.search]);

  // History handling
  function pushHistory(next: { shapes: Shape[]; unit: typeof unit }) {
    const newHist = history.slice(0, histIdx + 1);
    newHist.push({
      shapes: JSON.parse(JSON.stringify(next.shapes)),
      unit: next.unit,
    });
    setHistory(newHist);
    setHistIdx(newHist.length - 1);
  }
  useEffect(() => {
    pushHistory({ shapes, unit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sel = useMemo(
    () => shapes.find((s) => s.id === selected) || null,
    [selected, shapes],
  );

  function addRect() {
    const s: Shape = {
      id: uid(),
      type: "rect",
      x: 20,
      y: 20,
      width: 100,
      height: 20,
    };
    setShapes((prev) => {
      const next = [...prev, s];
      pushHistory({ shapes: next, unit });
      return next;
    });
    setSelected(s.id);
  }

  function addInlet() {
    const s: Shape = {
      id: uid(),
      type: "inlet",
      x: 10,
      y: 10,
      width: 10,
      height: 10,
    };
    setShapes((prev) => [...prev, s]);
    setSelected(s.id);
  }

  function addOutlet() {
    const s: Shape = {
      id: uid(),
      type: "outlet",
      x: 150,
      y: 10,
      width: 10,
      height: 10,
    };
    setShapes((prev) => [...prev, s]);
    setSelected(s.id);
  }

  function onMouseDownShape(
    e: React.MouseEvent,
    id: string,
    sx: number,
    sy: number,
  ) {
    e.stopPropagation();
    setSelected(id);
    const pt = clientToSvg(e);
    if (!pt) return;
    setDragId(id);
    setDragOff({ dx: pt.x - sx, dy: pt.y - sy });
  }

  function onMouseMove(e: React.MouseEvent) {
    const pt = clientToSvg(e);
    if (!pt) return;
    if (panning) {
      setPan((prev) => ({
        x: prev.x + e.movementX / zoom,
        y: prev.y + e.movementY / zoom,
      }));
      return;
    }
    if (resizeId) {
      // Resize bottom-right
      setShapes((prev) =>
        prev.map((s) => {
          if (s.id !== resizeId) return s;
          let w = pt.x - s.x;
          let h = pt.y - s.y;
          if (snap) {
            const g = 5;
            w = Math.round(w / g) * g;
            h = Math.round(h / g) * g;
          }
          return { ...s, width: Math.max(1, w), height: Math.max(1, h) };
        }),
      );
      return;
    }
    if (!dragId || !dragOff) return;
    const { dx, dy } = dragOff;
    let nx = pt.x - dx;
    let ny = pt.y - dy;
    if (snap) {
      const g = 5;
      nx = Math.round(nx / g) * g;
      ny = Math.round(ny / g) * g;
    }
    setShapes((prev) =>
      prev.map((s) => (s.id === dragId ? { ...s, x: nx, y: ny } : s)),
    );
  }

  function onMouseUp() {
    setDragId(null);
    setDragOff(null);
    setPanning(false);
    setResizeId(null);
    pushHistory({ shapes, unit });
  }

  function clientToSvg(e: React.MouseEvent): { x: number; y: number } | null {
    const svg = svgRef.current;
    const grp = gRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = (grp || svg).getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  async function importSvg(file: File) {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const rects = Array.from(doc.querySelectorAll("rect"));
    const lines = Array.from(doc.querySelectorAll("line"));
    const newShapes: Shape[] = [];
    for (const r of rects) {
      const x = Number(r.getAttribute("x") || 0);
      const y = Number(r.getAttribute("y") || 0);
      const w = Number(r.getAttribute("width") || 0);
      const h = Number(r.getAttribute("height") || 0);
      if (w > 0 && h > 0)
        newShapes.push({ id: uid(), type: "rect", x, y, width: w, height: h });
    }
    for (const l of lines) {
      const x1 = Number(l.getAttribute("x1") || 0);
      const y1 = Number(l.getAttribute("y1") || 0);
      const x2 = Number(l.getAttribute("x2") || 0);
      const y2 = Number(l.getAttribute("y2") || 0);
      const w = 10; // default thickness
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const len = Math.hypot(x2 - x1, y2 - y1);
      newShapes.push({
        id: uid(),
        type: "rect",
        x,
        y,
        width: len || w,
        height: w,
      });
    }
    if (newShapes.length) {
      setShapes((prev) => [...prev, ...newShapes]);
    }
  }

  function onImportClick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".svg,image/svg+xml";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) importSvg(f);
    };
    input.click();
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.1 : 0.9;
    setZoom((z) => Math.min(5, Math.max(0.2, z * factor)));
  }

  async function onImportDxfClick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".dxf";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const form = new FormData();
        form.append("file", f);
        form.append("default_width", String(10 * unitScale));
        form.append("scale", String(1));
        const res = await fetch(`${BASE_URL}/api/v1/import/dxf`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        // Open mapping dialog to refine by layer
        setDxfFile(f);
        setDxfLayers(data.layers || []);
        const initW: any = {};
        const initT: any = {};
        (data.layers || []).forEach((ly: string) => {
          initW[ly] = 10 * unitScale;
          initT[ly] = "rect";
        });
        setLayerWidths(initW);
        setLayerTypes(initT);
        setDxfDialogOpen(true);
      } catch (e: any) {
        notify(e?.message ?? "DXF import failed", "error");
      }
    };
    input.click();
  }

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={9}>
        <Paper sx={{ p: 1 }}>
          <Toolbar sx={{ gap: 1, flexWrap: "wrap" }}>
            <Button variant="contained" onClick={addRect}>
              Add Channel
            </Button>
            <Button onClick={addInlet}>Add Inlet</Button>
            <Button onClick={addOutlet}>Add Outlet</Button>
            <FormControlLabel
              control={
                <Switch
                  checked={snap}
                  onChange={(e) => setSnap(e.target.checked)}
                />
              }
              label="Snap"
            />
            <Button
              onClick={() =>
                download("geometry.json", JSON.stringify({ shapes }, null, 2))
              }
            >
              Export JSON
            </Button>
            <Button onClick={onImportClick}>Import SVG</Button>
            <Button onClick={onImportDxfClick}>Import DXF</Button>
            <Select
              size="small"
              value={unit}
              onChange={(e) => setUnit(e.target.value as any)}
            >
              <MenuItem value="um">µm</MenuItem>
              <MenuItem value="mm">mm</MenuItem>
              <MenuItem value="m">m</MenuItem>
            </Select>
            <Button
              onClick={() => {
                if (shapes.length === 0) return;
                const xs = shapes.map((s) => [s.x, s.x + s.width]).flat();
                const ys = shapes.map((s) => [s.y, s.y + s.height]).flat();
                const minx = Math.min(...xs),
                  maxx = Math.max(...xs);
                const miny = Math.min(...ys),
                  maxy = Math.max(...ys);
                const bboxW = maxx - minx,
                  bboxH = maxy - miny;
                const vw = 800,
                  vh = 500;
                const mz = Math.min(vw / (bboxW + 40), vh / (bboxH + 40));
                setZoom(Math.min(5, Math.max(0.2, mz)));
                setPan({
                  x: (vw - (minx + maxx) * mz) / mz / 2,
                  y: (vh - (miny + maxy) * mz) / mz / 2,
                });
              }}
            >
              Fit
            </Button>
            <Button
              onClick={() => {
                if (histIdx > 0) {
                  const h = history[histIdx - 1];
                  setHistIdx(histIdx - 1);
                  setShapes(h.shapes);
                  setUnit(h.unit);
                }
              }}
            >
              Undo
            </Button>
            <Button
              onClick={() => {
                if (histIdx + 1 < history.length) {
                  const h = history[histIdx + 1];
                  setHistIdx(histIdx + 1);
                  setShapes(h.shapes);
                  setUnit(h.unit);
                }
              }}
            >
              Redo
            </Button>
          </Toolbar>
          <Divider />
          <svg
            ref={svgRef}
            width="100%"
            height={500}
            viewBox={`0 0 ${800} ${500}`}
            style={{ background: "#f8f9fa", touchAction: "none" }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onMouseDown={(e) => {
              if ((e.target as any).tagName === "svg") {
                setSelected(null);
                setPanning(true);
              }
            }}
            onWheel={onWheel}
          >
            {/* grid */}
            {snap && (
              <defs>
                <pattern
                  id="grid"
                  width="10"
                  height="10"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 10 0 L 0 0 0 10"
                    fill="none"
                    stroke="#e9ecef"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
            )}
            <g
              ref={gRef}
              transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}
            >
              {snap && (
                <rect x={0} y={0} width={800} height={500} fill="url(#grid)" />
              )}
              {/* simple rulers */}
              <g>
                {Array.from({ length: 20 }).map((_, i) => {
                  const step = 50;
                  const x = i * step;
                  return (
                    <line
                      key={`rt-${i}`}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={10}
                      stroke="#adb5bd"
                    />
                  );
                })}
              </g>
              <g>
                {Array.from({ length: 20 }).map((_, i) => {
                  const step = 50;
                  const y = i * step;
                  return (
                    <line
                      key={`rl-${i}`}
                      x1={0}
                      y1={y}
                      x2={10}
                      y2={y}
                      stroke="#adb5bd"
                    />
                  );
                })}
              </g>
              {shapes.map((s) => (
                <g
                  key={s.id}
                  transform={`rotate(${s.rotation || 0}, ${s.x + s.width / 2}, ${s.y + s.height / 2})`}
                  onMouseDown={(e) => onMouseDownShape(e, s.id, s.x, s.y)}
                >
                  {s.type === "rect" && (
                    <rect
                      x={s.x}
                      y={s.y}
                      width={s.width}
                      height={s.height}
                      fill="#a5d8ff"
                      stroke={selected === s.id ? "#1976d2" : "#1c7ed6"}
                      strokeWidth={selected === s.id ? 2 : 1}
                    />
                  )}
                  {s.type !== "rect" && (
                    <rect
                      x={s.x}
                      y={s.y}
                      width={s.width}
                      height={s.height}
                      fill={s.type === "inlet" ? "#d3f9d8" : "#ffe3e3"}
                      stroke="#495057"
                    />
                  )}
                  {selected === s.id && (
                    // bottom-right resize handle
                    <rect
                      x={s.x + s.width - 5}
                      y={s.y + s.height - 5}
                      width={10}
                      height={10}
                      fill="#1976d2"
                      stroke="#0d47a1"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setResizeId(s.id);
                      }}
                    />
                  )}
                </g>
              ))}
            </g>
          </svg>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Inspector</Typography>
            {sel ? (
              <>
                <TextField
                  label="Type"
                  value={sel.type}
                  size="small"
                  inputProps={{ readOnly: true }}
                />
                <TextField
                  label={`X (${unit})`}
                  type="number"
                  size="small"
                  value={(sel.x / unitScale).toFixed(3)}
                  onChange={(e) =>
                    setShapes((prev) =>
                      prev.map((s) =>
                        s.id === sel.id
                          ? { ...s, x: Number(e.target.value) * unitScale }
                          : s,
                      ),
                    )
                  }
                />
                <TextField
                  label={`Y (${unit})`}
                  type="number"
                  size="small"
                  value={(sel.y / unitScale).toFixed(3)}
                  onChange={(e) =>
                    setShapes((prev) =>
                      prev.map((s) =>
                        s.id === sel.id
                          ? { ...s, y: Number(e.target.value) * unitScale }
                          : s,
                      ),
                    )
                  }
                />
                <TextField
                  label={`Width (${unit})`}
                  type="number"
                  size="small"
                  value={(sel.width / unitScale).toFixed(3)}
                  onChange={(e) =>
                    setShapes((prev) =>
                      prev.map((s) =>
                        s.id === sel.id
                          ? { ...s, width: Number(e.target.value) * unitScale }
                          : s,
                      ),
                    )
                  }
                />
                <TextField
                  label={`Height (${unit})`}
                  type="number"
                  size="small"
                  value={(sel.height / unitScale).toFixed(3)}
                  onChange={(e) =>
                    setShapes((prev) =>
                      prev.map((s) =>
                        s.id === sel.id
                          ? { ...s, height: Number(e.target.value) * unitScale }
                          : s,
                      ),
                    )
                  }
                />
                <TextField
                  label={`Rotation (deg)`}
                  type="number"
                  size="small"
                  value={sel.rotation || 0}
                  onChange={(e) =>
                    setShapes((prev) =>
                      prev.map((s) =>
                        s.id === sel.id
                          ? { ...s, rotation: Number(e.target.value) }
                          : s,
                      ),
                    )
                  }
                />
                <Button
                  color="error"
                  onClick={() =>
                    setShapes((prev) => prev.filter((s) => s.id !== sel.id))
                  }
                >
                  Delete
                </Button>
                <Divider />
                <Button
                  variant="contained"
                  onClick={() =>
                    download(
                      "geometry.json",
                      JSON.stringify({ unit, shapes }, null, 2),
                    )
                  }
                >
                  Save Project
                </Button>
                <Button
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "application/json";
                    input.onchange = async () => {
                      const f = input.files?.[0];
                      if (!f) return;
                      try {
                        const txt = await f.text();
                        const data = JSON.parse(txt);
                        if (Array.isArray(data.shapes))
                          setShapes(
                            data.shapes.map((d: any) => ({ ...d, id: uid() })),
                          );
                        if (data.unit) setUnit(data.unit);
                        notify("Project loaded", "success");
                      } catch (e: any) {
                        notify(e?.message ?? "Failed to load project", "error");
                      }
                    };
                    input.click();
                  }}
                >
                  Open Project
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const p = await createProject(
                        newProjectName || "Untitled",
                        { unit, shapes },
                      );
                      notify(`Saved to server: ${p.name}`, "success");
                    } catch (e: any) {
                      notify(e?.message ?? "Save failed", "error");
                    }
                  }}
                >
                  Save to Server
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const items = await listProjects();
                      setProjects(items);
                      setProjectDialogOpen(true);
                    } catch (e: any) {
                      notify(e?.message ?? "Load failed", "error");
                    }
                  }}
                >
                  Open From Server
                </Button>
                <TextField
                  label="Inlet u_avg (m/s)"
                  type="number"
                  size="small"
                  value={inletU}
                  onChange={(e) => setInletU(Number(e.target.value))}
                  sx={{ width: 220 }}
                />
                <Button
                  variant="outlined"
                  onClick={() => {
                    const payload = {
                      name: "Editor Job",
                      geometry: { width: 1, height: 1 },
                      material: {
                        density: 1000,
                        viscosity: 0.001,
                        diffusivity: 1e-9,
                      },
                      boundaries: [
                        { type: "inlet", value: inletU },
                        { type: "outlet", value: 0 },
                        { type: "wall" },
                      ],
                      solve_transport: true,
                      geometry_json: { unit, shapes },
                    };
                    fetch(`${BASE_URL}/api/v1/jobs`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    })
                      .then(async (r) => {
                        if (!r.ok) throw new Error(await r.text());
                        return r.json();
                      })
                      .then(() => notify("Job submitted", "success"))
                      .catch((e) =>
                        notify(e?.message ?? "Job submission failed", "error"),
                      );
                  }}
                >
                  Run Simulation
                </Button>
              </>
            ) : (
              <Typography color="text.secondary">
                Select a shape to edit.
              </Typography>
            )}
            <TextField
              label="Server Project Name"
              size="small"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
          </Stack>
        </Paper>
      </Grid>
      <Dialog
        open={projectDialogOpen}
        onClose={() => setProjectDialogOpen(false)}
        fullWidth
      >
        <DialogTitle>Select a Project</DialogTitle>
        <DialogContent dividers>
          <List>
            {projects.map((p) => (
              <ListItem
                key={p.id}
                button
                onClick={async () => {
                  try {
                    const loaded = await apiGetProject(p.id);
                    const data = loaded.data || {};
                    if (Array.isArray(data.shapes))
                      setShapes(
                        data.shapes.map((d: any) => ({ ...d, id: uid() })),
                      );
                    if (data.unit) setUnit(data.unit);
                    setProjectDialogOpen(false);
                    notify(`Loaded ${loaded.name}`, "success");
                  } catch (e: any) {
                    notify(e?.message ?? "Failed to open project", "error");
                  }
                }}
              >
                <ListItemText primary={p.name} secondary={p.id} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProjectDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={dxfDialogOpen}
        onClose={() => setDxfDialogOpen(false)}
        fullWidth
      >
        <DialogTitle>DXF Layer Mapping</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Set width (in current unit) and type per layer
          </Typography>
          {dxfLayers.map((ly) => (
            <Stack key={ly} direction="row" spacing={2} sx={{ mb: 1 }}>
              <TextField
                label="Layer"
                value={ly}
                size="small"
                inputProps={{ readOnly: true }}
                sx={{ width: 180 }}
              />
              <TextField
                label={`Width (${unit})`}
                type="number"
                size="small"
                value={(
                  (layerWidths[ly] ?? 10 * unitScale) / unitScale
                ).toString()}
                onChange={(e) =>
                  setLayerWidths((prev) => ({
                    ...prev,
                    [ly]: Number(e.target.value) * unitScale,
                  }))
                }
                sx={{ width: 180 }}
              />
              <Select
                size="small"
                value={layerTypes[ly] ?? "rect"}
                onChange={(e) =>
                  setLayerTypes((prev) => ({
                    ...prev,
                    [ly]: String(e.target.value),
                  }))
                }
                sx={{ width: 180 }}
              >
                <MenuItem value="rect">Channel</MenuItem>
                <MenuItem value="inlet">Inlet</MenuItem>
                <MenuItem value="outlet">Outlet</MenuItem>
              </Select>
            </Stack>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDxfDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!dxfFile) return;
              try {
                const form = new FormData();
                form.append("file", dxfFile);
                form.append("default_width", String(10 * unitScale));
                form.append("scale", String(1));
                form.append("layer_widths", JSON.stringify(layerWidths));
                form.append("layer_types", JSON.stringify(layerTypes));
                const res = await fetch(`${BASE_URL}/api/v1/import/dxf`, {
                  method: "POST",
                  body: form,
                });
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();
                const dshapes: Shape[] = data.shapes.map((s: any) => ({
                  id: uid(),
                  type: s.type || "rect",
                  x: s.x,
                  y: s.y,
                  width: s.width,
                  height: s.height,
                }));
                setShapes((prev) => [...prev, ...dshapes]);
                setDxfDialogOpen(false);
                notify("DXF imported with mapping", "success");
              } catch (e: any) {
                notify(e?.message ?? "Import failed", "error");
              }
            }}
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
