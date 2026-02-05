"use client";

import { useState } from "react";
import {
  Paper,
  Stack,
  Typography,
  TextField,
  MenuItem,
  Button
} from "@mui/material";

const STATUS_OPTIONS = [
  { label: "Blocked", value: "Blocked" },
  { label: "Suspicious", value: "Pending" },
  { label: "Allowed", value: "Allowed" }
];

const CATEGORY_OPTIONS = ["Phishing", "Social", "Safe", "Unknown"];

export default function ManualSiteEntryForm() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("Pending");
  const [category, setCategory] = useState("Unknown");
  const [reason, setReason] = useState("");
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/web-filter/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          status,
          category,
          threatIntel: reason
            ? { manualEntry: true, reason: reason.trim(), taggedAt: new Date().toISOString() }
            : { manualEntry: true, taggedAt: new Date().toISOString() }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Update failed");
      }

      setMessage(`Saved ${data.url} as ${status}.`);
      setUrl("");
      setReason("");
      notifyRefresh();
    } catch (error) {
      setMessage(error.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={1} sx={{ p: 2 }} component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={700}>
          Manual Site Entry
        </Typography>
        <Typography color="text.secondary">
          Add a site to block or mark as suspicious.
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            label="Site URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="example.com"
            fullWidth
            required
          />
          <TextField
            select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            sx={{ minWidth: 180 }}
          >
            {STATUS_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            sx={{ minWidth: 180 }}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <TextField
          label="Reason / Notes"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why is this suspicious or blocked?"
          multiline
          minRows={3}
        />
        <Stack direction="row" spacing={2} alignItems="center">
          <Button type="submit" variant="contained" disabled={loading}>
            Save Site
          </Button>
          {message ? <Typography variant="body2">{message}</Typography> : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
