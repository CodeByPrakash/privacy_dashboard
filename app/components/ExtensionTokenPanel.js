"use client";

import { useEffect, useState } from "react";
import { Button, Paper, Stack, Typography, TextField } from "@mui/material";

export default function ExtensionTokenPanel() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const response = await fetch("/api/auth/extension-token", { cache: "no-store" });
        const data = await response.json();
        if (response.ok && data.token) {
          setToken(data.token);
        }
      } catch {
        // ignore
      }
    };
    loadToken();
  }, []);

  const generate = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/extension-token", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate token");
      }
      setToken(data.token || "");
      setMessage("Token generated. Copy it into the extension settings.");
    } catch (error) {
      setMessage(error.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
      <Stack spacing={2}>
        <div>
          <Typography variant="h6" fontWeight={700}>
            Extension Access Token
          </Typography>
          <Typography color="text.secondary">
            Generate a token to connect your browser extension without exposing your student ID.
          </Typography>
        </div>
        <TextField
          label="Token"
          value={token}
          placeholder="Generate a token"
          InputProps={{ readOnly: true }}
          fullWidth
        />
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Button variant="contained" onClick={generate} disabled={loading}>
            {loading ? "Generating..." : "Generate Token"}
          </Button>
          {token ? (
            <Button
              variant="outlined"
              onClick={() => {
                navigator.clipboard.writeText(token);
                setMessage("Token copied to clipboard.");
              }}
            >
              Copy Token
            </Button>
          ) : null}
        </Stack>
        {message ? <Typography variant="body2">{message}</Typography> : null}
      </Stack>
    </Paper>
  );
}
