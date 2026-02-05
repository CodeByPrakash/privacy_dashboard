"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField, Alert, Stack } from "@mui/material";

export default function UrlCheckForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setStatus(null);
    try {
      const response = await fetch("/api/activity/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      setStatus(data.allowed ? "Allowed" : "Blocked");
      setMessage(data.reason || "Logged");
      setUrl("");
      window.dispatchEvent(new Event("pd-activity-logged"));
      router.refresh();
    } catch (error) {
      setStatus("Error");
      setMessage(error.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Stack spacing={2}>
        <TextField
          label="Test a website URL"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com"
          required
        />
        <Button variant="contained" type="submit" disabled={loading}>
          {loading ? "Checking..." : "Check & Log"}
        </Button>
        {status ? <Alert severity="info">Status: {status} — {message}</Alert> : null}
      </Stack>
    </form>
  );
}
