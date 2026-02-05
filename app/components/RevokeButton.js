"use client";

import { useState } from "react";
import { Button, Typography, Stack } from "@mui/material";

export default function RevokeButton({ studentId, securityLevel }) {
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

  const revoke = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/enforcer/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, reason: "Admin revoke from console" })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Revoke failed");
      }

      setMessage("Revoked");
      notifyRefresh();
    } catch (error) {
      setMessage(error.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const restore = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/enforcer/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, reason: "Admin restore from console" })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Restore failed");
      }

      setMessage("Restored");
      notifyRefresh();
    } catch (error) {
      setMessage(error.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" color="error" onClick={revoke} disabled={loading} size="small">
        {loading ? "Revoking..." : "Revoke"}
      </Button>
      <Button
        variant="outlined"
        color="success"
        onClick={restore}
        disabled={loading || securityLevel !== "revoked"}
        size="small"
      >
        Allow
      </Button>
      {message ? <Typography variant="caption">{message}</Typography> : null}
    </Stack>
  );
}
