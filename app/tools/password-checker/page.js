"use client";

import { useMemo, useState } from "react";
import zxcvbn from "zxcvbn";
import {
  Container,
  Paper,
  Typography,
  TextField,
  Box,
  LinearProgress,
  List,
  ListItem,
  IconButton,
  InputAdornment
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";

const labels = ["Very Weak", "Weak", "Moderate", "Strong", "Very Strong"];
const colors = ["#dc2626", "#f97316", "#f59e0b", "#10b981", "#16a34a"];

export default function PasswordCheckerPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const result = useMemo(() => {
    if (!password) return null;
    return zxcvbn(password);
  }, [password]);

  const score = result?.score ?? 0;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={2} sx={{ p: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Password Security Checker
        </Typography>
        <Typography color="text.secondary">
          Enter a mock password to see strength feedback. This is client-side only.
        </Typography>

        <TextField
          label="Password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Type a mock password"
          fullWidth
          sx={{ mt: 2 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  edge="end"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                </IconButton>
              </InputAdornment>
            )
          }}
        />

        <Box sx={{ mt: 2 }}>
          <Typography fontWeight={600}>Strength</Typography>
          <Typography sx={{ fontSize: "1.25rem", color: colors[score] || "text.disabled" }}>
            {labels[score] || "-"}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(score + 1) * 20}
            sx={{
              mt: 1,
              height: 10,
              borderRadius: 999,
              backgroundColor: "#e2e8f0",
              "& .MuiLinearProgress-bar": {
                backgroundColor: colors[score] || "#94a3b8"
              }
            }}
          />
        </Box>

        {result ? (
          <Box sx={{ mt: 3 }}>
            <Typography fontWeight={600}>Feedback</Typography>
            <List>
              {result.feedback?.warning ? <ListItem>{result.feedback.warning}</ListItem> : null}
              {(result.feedback?.suggestions || []).map((tip) => (
                <ListItem key={tip}>{tip}</ListItem>
              ))}
              {result.feedback?.warning || result.feedback?.suggestions?.length ? null : (
                <ListItem>Looks good. Consider using a password manager.</ListItem>
              )}
            </List>
          </Box>
        ) : null}
      </Paper>
    </Container>
  );
}
