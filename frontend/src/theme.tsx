import {
  createTheme,
  CssBaseline,
  PaletteMode,
  ThemeProvider,
} from "@mui/material";
import React from "react";

type ColorModeCtx = { mode: PaletteMode; toggle: () => void };

export const ColorModeContext = React.createContext<ColorModeCtx>({
  mode: "light",
  toggle: () => {},
});

function getInitialMode(): PaletteMode {
  const saved =
    typeof window !== "undefined"
      ? (window.localStorage.getItem("color-mode") as PaletteMode | null)
      : null;
  if (saved === "light" || saved === "dark") return saved;
  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export const ColorModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setMode] = React.useState<PaletteMode>(getInitialMode());

  const toggle = React.useCallback(() => {
    setMode((m) => (m === "light" ? "dark" : "light"));
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem("color-mode", mode);
    } catch {}
  }, [mode]);

  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: mode === "light" ? "#1976d2" : "#90caf9" },
          secondary: { main: "#9c27b0" },
        },
        shape: { borderRadius: 8 },
        typography: {
          fontFamily:
            "Roboto, system-ui, -apple-system, Segoe UI, Arial, sans-serif",
        },
      }),
    [mode],
  );

  return (
    <ColorModeContext.Provider value={{ mode, toggle }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};
