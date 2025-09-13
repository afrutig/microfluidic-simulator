import { Alert, AlertColor, Snackbar } from "@mui/material";
import React from "react";

type SnackbarCtx = {
  notify: (msg: string, severity?: AlertColor) => void;
};

export const SnackbarContext = React.createContext<SnackbarCtx>({
  notify: () => {},
});

export const useSnackbar = () => React.useContext(SnackbarContext);

export const SnackbarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState<string>("");
  const [severity, setSeverity] = React.useState<AlertColor>("info");

  const notify = React.useCallback((msg: string, sev: AlertColor = "info") => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  return (
    <SnackbarContext.Provider value={{ notify }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
};
