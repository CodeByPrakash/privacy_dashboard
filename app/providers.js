"use client";

import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#6366f1" },
    secondary: { main: "#1e293b" },
    success: { main: "#10b981" },
    warning: { main: "#f59e0b" },
    error: { main: "#e11d48" },
    background: {
      default: "#f8fafc",
      paper: "#ffffff"
    },
    text: {
      primary: "#1e293b",
      secondary: "#475569"
    }
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
  }
});

export default function Providers({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
