"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Typography, Stack } from "@mui/material";

export default function AdminBlockButton({ url }) {
  const router = useRouter();
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

  const block = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/web-filter/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          status: "Blocked",
          threatIntel: { source: "admin", reason: "Blocked from activity review" }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Block failed");
      }

      setMessage("Blocked");
      router.refresh();
      notifyRefresh();
    } catch (error) {
      setMessage(error.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Button variant="contained" color="error" size="small" onClick={block} disabled={loading}>
        {loading ? "Blocking..." : "Block"}
      </Button>
      {message ? <Typography variant="caption">{message}</Typography> : null}
    </Stack>
  );
}
