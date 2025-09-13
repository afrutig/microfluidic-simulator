import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  deleteProject,
  getProject as apiGetProject,
  listProjects,
  updateProject,
} from "../api/client";
import { useSnackbar } from "../ui/SnackbarProvider";

export default function Projects() {
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const nav = useNavigate();
  const { notify } = useSnackbar();

  async function refresh() {
    try {
      const data = await listProjects();
      setItems(data.map((p) => ({ id: p.id, name: p.name })));
    } catch (e: any) {
      notify(e?.message ?? "Failed to load projects", "error");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Projects</Typography>
        <List>
          {items.map((p) => (
            <ListItem
              key={p.id}
              secondaryAction={
                <>
                  <Button
                    size="small"
                    onClick={async () => {
                      try {
                        const proj = await apiGetProject(p.id);
                        // Navigate to editor with project loaded via query param
                        sessionStorage.setItem(
                          "openProjectData",
                          JSON.stringify(proj),
                        );
                        nav(`/editor?project=${p.id}`);
                      } catch (e: any) {
                        notify(e?.message ?? "Open failed", "error");
                      }
                    }}
                  >
                    Open
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setRenameId(p.id);
                      setRenameName(p.name);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={async () => {
                      await deleteProject(p.id);
                      notify("Deleted", "success");
                      refresh();
                    }}
                  >
                    Delete
                  </Button>
                </>
              }
            >
              <ListItemText primary={p.name} secondary={p.id} />
            </ListItem>
          ))}
        </List>
      </Stack>
      <Dialog open={!!renameId} onClose={() => setRenameId(null)}>
        <DialogTitle>Rename Project</DialogTitle>
        <DialogContent>
          <TextField
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            autoFocus
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameId(null)}>Cancel</Button>
          <Button
            onClick={async () => {
              if (!renameId) return;
              const proj = await apiGetProject(renameId);
              await updateProject(renameId, renameName, proj.data);
              notify("Renamed", "success");
              setRenameId(null);
              refresh();
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
