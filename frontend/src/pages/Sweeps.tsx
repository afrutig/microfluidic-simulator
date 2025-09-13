import {
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import { BASE_URL } from "../api/client";
import { useSnackbar } from "../ui/SnackbarProvider";

type SweepStatus = {
  id: string;
  jobs: { id: string; status: string }[];
  done: boolean;
};

export default function Sweeps() {
  const [name, setName] = useState("Sweep 1");
  const [variants, setVariants] = useState(
    '[{"material": {"viscosity": 0.001}}, {"material": {"viscosity": 0.002}}]',
  );
  const [sid, setSid] = useState<string | null>(null);
  const [status, setStatus] = useState<SweepStatus | null>(null);
  const { notify } = useSnackbar();

  async function createSweep() {
    try {
      const vars = JSON.parse(variants);
      const base = {
        name: "Base",
        geometry: { width: 1, height: 1 },
        material: { density: 1000, viscosity: 0.001, diffusivity: 1e-9 },
        boundaries: [{ type: "wall" }],
        solve_transport: true,
      };
      const res = await fetch(`${BASE_URL}/api/v1/sweeps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, base, variants: vars }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSid(data.id);
      notify("Sweep created", "success");
    } catch (e: any) {
      notify(e?.message ?? "Failed to create sweep", "error");
    }
  }

  useEffect(() => {
    let timer: any;
    async function poll() {
      if (!sid) return;
      const res = await fetch(`${BASE_URL}/api/v1/sweeps/${sid}`);
      if (res.ok) {
        const st = await res.json();
        setStatus(st);
      }
      timer = setTimeout(poll, 1000);
    }
    poll();
    return () => clearTimeout(timer);
  }, [sid]);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Parameter Sweeps</Typography>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Variants (JSON array of overrides)"
          value={variants}
          onChange={(e) => setVariants(e.target.value)}
          multiline
          minRows={4}
        />
        <Button variant="contained" onClick={createSweep}>
          Run Sweep
        </Button>
        <Divider />
        {status && (
          <>
            <Typography>Batch: {status.id}</Typography>
            <List>
              {status.jobs.map((j) => (
                <ListItem key={j.id}>
                  <ListItemText primary={j.id} secondary={j.status} />
                </ListItem>
              ))}
            </List>
            {status.done && (
              <Button
                href={`${BASE_URL}/api/v1/sweeps/${status.id}/csv`}
                target="_blank"
              >
                Download CSV
              </Button>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}
