import { Brightness4, Brightness7, Science } from "@mui/icons-material";
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import React from "react";
import { Link as RouterLink, Outlet } from "react-router-dom";

import { ColorModeContext } from "./theme";

export default function App() {
  const { mode, toggle } = React.useContext(ColorModeContext);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Science sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Microfluidic Simulator
          </Typography>
          <Button color="inherit" component={RouterLink} to="/">
            New Job
          </Button>
          <Button color="inherit" component={RouterLink} to="/jobs">
            Jobs
          </Button>
          <Button color="inherit" component={RouterLink} to="/projects">
            Projects
          </Button>
          <Button color="inherit" component={RouterLink} to="/sweeps">
            Sweeps
          </Button>
          <Button color="inherit" component={RouterLink} to="/editor">
            Editor
          </Button>
          <IconButton
            color="inherit"
            onClick={toggle}
            aria-label="Toggle color mode"
            sx={{ ml: 1 }}
          >
            {mode === "dark" ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3, flexGrow: 1 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
