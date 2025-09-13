import {
  Chip,
  Divider,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import { getJob } from "../api/client";
import { type JobHistoryItem, loadHistory } from "../storage";

type StatusMap = Record<string, string>;

export default function Jobs() {
  const [items, setItems] = useState<JobHistoryItem[]>(loadHistory());
  const [status, setStatus] = useState<StatusMap>({});

  useEffect(() => {
    let cancelled = false;
    async function fetchStatuses() {
      const s: StatusMap = {};
      for (const it of items) {
        try {
          const js = await getJob(it.id);
          s[it.id] = js.status;
        } catch {
          s[it.id] = "unknown";
        }
      }
      if (!cancelled) setStatus(s);
    }
    fetchStatuses();
    return () => {
      cancelled = true;
    };
  }, [items]);

  if (items.length === 0) {
    return (
      <Typography>No jobs yet. Submit a new job from the home page.</Typography>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Recent Jobs</Typography>
        <List>
          {items.map((it, idx) => (
            <>
              <ListItem
                key={it.id}
                secondaryAction={
                  <Chip
                    size="small"
                    label={status[it.id] ?? "…"}
                    color={
                      status[it.id] === "finished"
                        ? "success"
                        : status[it.id] === "failed"
                          ? "error"
                          : "default"
                    }
                  />
                }
              >
                <ListItemText
                  primary={
                    <Link component={RouterLink} to={`/jobs/${it.id}`}>
                      {it.name}
                    </Link>
                  }
                  secondary={new Date(it.createdAt).toLocaleString()}
                />
              </ListItem>
              {idx < items.length - 1 && <Divider component="li" />}
            </>
          ))}
        </List>
      </Stack>
    </Paper>
  );
}
