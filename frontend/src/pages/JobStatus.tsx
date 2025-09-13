import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  artifactDownloadUrl,
  getJob,
  getJobResult,
  type JobStatus as JobStatusType,
  listArtifacts,
} from "../api/client";
import { useSnackbar } from "../ui/SnackbarProvider";

export default function JobStatus() {
  const { id } = useParams();
  const [status, setStatus] = useState<JobStatusType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<
    { name: string; size: number; url: string }[] | null
  >(null);
  const { notify } = useSnackbar();
  const nav = useNavigate();
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    async function poll() {
      if (!id) return;
      try {
        const s = await getJob(id);
        if (!cancelled) setStatus(s);
        if (s.status === "finished" || s.status === "failed") {
          try {
            const a = await listArtifacts(s.id);
            if (!cancelled) setArtifacts(a.artifacts);
          } catch {}
          return;
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to get status");
      }
      timer = window.setTimeout(poll, 1000);
    }
    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [id]);

  if (!id) return <Typography>Missing job id.</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!status) return <Typography>Loading…</Typography>;

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Job Status</Typography>
          <Typography>
            <strong>ID:</strong> {status.id}
          </Typography>
          <Typography>
            <strong>Status:</strong> {status.status}
          </Typography>
          {status.status === "failed" && (
            <Stack spacing={1}>
              <Typography color="error">
                {(status as any).error ||
                  "Job failed. Check server logs for details."}
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  const errArt = artifacts?.find((a) =>
                    a.name.endsWith("-error.txt"),
                  );
                  if (errArt) {
                    window.open(
                      artifactDownloadUrl(status.id, errArt.name),
                      "_blank",
                      "noopener,noreferrer",
                    );
                  } else if ((status as any).error) {
                    setErrorText((status as any).error as string);
                    setErrorDialogOpen(true);
                  } else {
                    notify("No error details available", "warning");
                  }
                }}
              >
                View Error
              </Button>
            </Stack>
          )}
          <Stack>
            <Typography>Progress</Typography>
            <LinearProgress
              variant={status.progress ? "determinate" : "indeterminate"}
              value={(status.progress ?? 0) * 100}
            />
          </Stack>
          {(status.status === "finished" || status.status === "failed") && (
            <Stack spacing={1}>
              <Typography variant="subtitle1">Artifacts</Typography>
              {artifacts ? (
                <List dense>
                  {artifacts.map((f) => (
                    <ListItem key={f.name}>
                      <ListItemText primary={f.name} secondary={`${f.size} bytes`} />
                      <Stack direction="row" spacing={1}>
                        <Button href={artifactDownloadUrl(status.id, f.name)} target="_blank" rel="noreferrer">Download</Button>
                        {f.name.endsWith('.vtu') && (
                          <Button onClick={() => nav(`/viewer?job=${encodeURIComponent(status.id)}&name=${encodeURIComponent(f.name)}`)}>Preview</Button>
                        )}
                      </Stack>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography>No artifacts found.</Typography>
              )}
              {artifacts &&
                artifacts.find((a) => a.name.endsWith("-geometry.json")) && (
                  <Button
                    variant="contained"
                    onClick={async () => {
                      try {
                        const geom = artifacts.find((a) =>
                          a.name.endsWith("-geometry.json"),
                        );
                        if (!geom) return;
                        const res = await fetch(
                          artifactDownloadUrl(status.id, geom.name),
                        );
                        const data = await res.json();
                        sessionStorage.setItem(
                          "openProjectData",
                          JSON.stringify({ name: `Job ${status.id}`, data }),
                        );
                        nav("/editor");
                      } catch (e: any) {
                        notify(e?.message ?? "Open in editor failed", "error");
                      }
                    }}
                  >
                    Open Geometry in Editor
                  </Button>
                )}
              <Button
                variant="outlined"
                onClick={async () => {
                  try {
                    const data = await getJobResult(status.id);
                    const blob = new Blob([JSON.stringify(data, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `job-${status.id}-result.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (e: any) {
                    notify(e?.message ?? "Download failed", "error");
                  }
                }}
              >
                Download result (JSON)
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>
      <Dialog
        open={errorDialogOpen}
        onClose={() => setErrorDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Error Details</DialogTitle>
        <DialogContent dividers>
          <Typography component="pre" sx={{ whiteSpace: "pre-wrap" }}>
            {errorText}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setErrorDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
