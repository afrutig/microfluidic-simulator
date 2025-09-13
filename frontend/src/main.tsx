import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import App from "./App";
import Editor from "./pages/Editor";
import JobForm from "./pages/JobForm";
import Jobs from "./pages/Jobs";
import JobStatus from "./pages/JobStatus";
import Projects from "./pages/Projects";
import Sweeps from "./pages/Sweeps";
import VtkViewer from "./pages/VtkViewer";
import { ColorModeProvider } from "./theme";
import { SnackbarProvider } from "./ui/SnackbarProvider";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <JobForm /> },
      { path: "/jobs/:id", element: <JobStatus /> },
      { path: "/jobs", element: <Jobs /> },
      { path: "/projects", element: <Projects /> },
      { path: "/editor", element: <Editor /> },
      { path: "/sweeps", element: <Sweeps /> },
      { path: "/viewer", element: <VtkViewer /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ColorModeProvider>
      <SnackbarProvider>
        <RouterProvider router={router} />
      </SnackbarProvider>
    </ColorModeProvider>
  </React.StrictMode>,
);
