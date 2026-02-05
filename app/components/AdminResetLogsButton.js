"use client";

import { useState } from "react";
import { Button, Typography, Stack } from "@mui/material";

export default function AdminResetLogsButton({ studentId }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const notifyRefresh = () => {
    window.dispatchEvent(new Event("pd-refresh"));
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("pd-updates");
      channel.postMessage("refresh");
      channel.close();
    }
  };

  const resetLogs = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/students/${studentId}/clear-activity`, {
        method: "POST"
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Reset failed");
      }

      setMessage("Logs cleared");
      notifyRefresh();
    } catch (error) {
      setMessage(error.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="outlined" color="warning" onClick={resetLogs} disabled={loading} size="small">
        {loading ? "Clearing..." : "Clear Logs"}
      </Button>
      {message ? <Typography variant="caption">{message}</Typography> : null}
    </Stack>
  );
}
