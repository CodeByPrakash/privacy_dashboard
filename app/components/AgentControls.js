"use client";

import { useState } from "react";
import { Button, Stack, TextField, Alert, Typography } from "@mui/material";

export default function AgentControls() {
  const [studentId, setStudentId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async (endpoint, body) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }
      setMessage("Action completed");
    } catch (error) {
      setMessage(error.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" fontWeight={600}>
        Agent Controls
      </Typography>
      <TextField
        label="Student ID (numeric)"
        value={studentId}
        onChange={(event) => setStudentId(event.target.value)}
        placeholder="e.g. 1"
      />
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Button
          variant="contained"
          onClick={() => run("/api/guardian/vibe-check-all")}
          disabled={loading}
        >
          Run Guardian (All)
        </Button>
        <Button
          variant="outlined"
          onClick={() => run("/api/guardian/vibe-check/" + Number(studentId))}
          disabled={loading || !studentId}
        >
          Run Guardian (Student)
        </Button>
        <Button
          variant="outlined"
          onClick={() => run("/api/sleuth/scan-unknown")}
          disabled={loading}
        >
          Run Sleuth Scan
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={() => run("/api/enforcer/revoke", { studentId: Number(studentId), reason: "Manual admin revoke" })}
          disabled={loading || !studentId}
        >
          Run Enforcer Revoke
        </Button>
      </Stack>
      {message ? <Alert severity="info">{message}</Alert> : null}
    </Stack>
  );
}
