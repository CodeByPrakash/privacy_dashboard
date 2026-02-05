"use client";

import { useState } from "react";
import { Button, Typography, Stack } from "@mui/material";

export default function RefineButton({ url, status }) {
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

  const updateStatus = async (nextStatus) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/web-filter/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, status: nextStatus })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Update failed");
      }

      setMessage(`Set to ${nextStatus}`);
      notifyRefresh();
    } catch (error) {
      setMessage(error.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Button
        variant="contained"
        color="error"
        size="small"
        onClick={() => updateStatus("Blocked")}
        disabled={loading || status === "Blocked"}
      >
        Block
      </Button>
      <Button
        variant="contained"
        color="success"
        size="small"
        onClick={() => updateStatus("Allowed")}
        disabled={loading || status === "Allowed"}
      >
        Allow
      </Button>
      {message ? <Typography variant="caption">{message}</Typography> : null}
    </Stack>
  );
}
