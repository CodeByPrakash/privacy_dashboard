"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Paper,
  Slider,
  Stack,
  Typography
} from "@mui/material";
import ScoreGauge from "@/app/components/ScoreGauge";

const sliderStops = [
  { label: "Safe Browsing", score: 92, text: "Clean browsing, 2FA enabled." },
  { label: "Unknown Links", score: 72, text: "A few unknown domains hit your logs." },
  { label: "Suspicious Site", score: 54, text: "Tracker-heavy site blocked by Sleuth." },
  { label: "Password: 123456", score: 28, text: "Weak password + suspicious activity." }
];

export default function HomePage() {
  const [step, setStep] = useState(0);
  const vibe = sliderStops[step];
  const glowColor = vibe.score > 70 ? "#64ffda" : vibe.score > 40 ? "#a855f7" : "#ef4444";

  const heroCardStyle = useMemo(
    () => ({
      p: 4,
      position: "relative",
      overflow: "hidden",
      borderRadius: 4,
      background: "linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.9) 100%)",
      border: "1px solid rgba(99, 102, 241, 0.18)",
      boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)"
    }),
    []
  );

  return (
    <Box className="page-shell">
      <Box className="hero-grid" />
      <Box className="blur-orb orb-1" />
      <Box className="blur-orb orb-2" />
      <Container maxWidth={false} className="desktop-wide" sx={{ py: 6, position: "relative", zIndex: 1 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={7}>
            <Paper className="glass-strong" sx={heroCardStyle}>
              <Chip
                label="Cyber-Glass Privacy"
                sx={{ mb: 2, color: "#0f172a", borderColor: "rgba(15, 23, 42, 0.2)", backgroundColor: "rgba(255,255,255,0.7)" }}
                variant="outlined"
              />
              <Typography
                variant="h2"
                fontWeight={800}
                sx={{ mb: 2, color: "#0f172a", letterSpacing: "-0.02em" }}
              >
                Master Your Digital Ghost.
              </Typography>
              <Typography sx={{ color: "#475569", mb: 3, fontSize: "1.1rem" }}>
                A proactive privacy engine for students who code and startups that scale. Secure your data and raise your vibe.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap">
                <Button
                  component={Link}
                  href="/student"
                  variant="contained"
                  sx={{
                    background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)",
                    color: "#ffffff",
                    boxShadow: "0 14px 30px rgba(56, 189, 248, 0.35)",
                    borderRadius: 99
                  }}
                >
                  Enter the Grid
                </Button>
                <Button
                  component={Link}
                  href="/student#score-checker"
                  variant="outlined"
                  sx={{ borderColor: "rgba(15, 23, 42, 0.3)", color: "#0f172a" }}
                >
                  Check Your Score
                </Button>
                <Button
                  component="a"
                  href="/extension.zip"
                  download
                  variant="outlined"
                  sx={{ borderColor: "rgba(99, 102, 241, 0.6)", color: "#6366f1" }}
                >
                  Download Extension
                </Button>
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={5}>
            <Paper className="glass" sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Vibe Meter Demo
              </Typography>
              <Typography sx={{ color: "#475569" }}>Your security isn’t a setting. It’s a vibe.</Typography>
              <Box sx={{ mt: 2 }}>
                <ScoreGauge score={vibe.score} />
                <Typography sx={{ mt: 1, color: "#475569" }}>{vibe.text}</Typography>
              </Box>
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ color: "#64748b" }}>
                  Simulate your activity
                </Typography>
                <Slider
                  value={step}
                  onChange={(_, value) => setStep(value)}
                  min={0}
                  max={sliderStops.length - 1}
                  step={1}
                  marks
                  sx={{
                    mt: 1,
                    color: glowColor
                  }}
                />
                <Typography variant="caption" sx={{ color: "#64748b" }}>
                  {vibe.label}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        <Stack spacing={2} sx={{ mt: 4 }}>
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ color: "#0f172a" }}>
              The Privacy Agents
            </Typography>
            <Typography sx={{ color: "#64748b" }}>
              Four roles, one mission: keep students safe without slowing them down.
            </Typography>
          </Box>

          <Grid container spacing={2}>
            {[
              {
                title: "Guardian",
                text: "Autonomous Scoring",
                accent: "#64ffda",
                metric: "+18 avg score",
                detail: "Score jumps from 40 → 90 as you enable 2FA.",
                bullets: ["Daily risk pulse", "Auto audit trail"]
              },
              {
                title: "Sleuth",
                text: "Phishing Assassin",
                accent: "#a855f7",
                metric: "98% block rate",
                detail: "Suspicious URL zapped into Blocked state.",
                bullets: ["URL intel tagging", "Suspicious streaks"]
              },
              {
                title: "Enforcer",
                text: "Kill-Switch Control",
                accent: "#f97316",
                metric: "1-click revoke",
                detail: "Instant revoke with post-mortem report.",
                bullets: ["Session shutdown", "Report export"]
              },
              {
                title: "Transparency",
                text: "No Shadow Data",
                accent: "#38bdf8",
                metric: "Full traceability",
                detail: "JSON metadata stays visible and traceable.",
                bullets: ["Explainable scores", "Audit-ready logs"]
              }
            ].map((card) => (
              <Grid key={card.title} item xs={12} md={6}>
                <Paper
                  className="glass"
                  sx={{
                    p: 3,
                    borderRadius: 4,
                    border: "1px solid rgba(148, 163, 184, 0.25)",
                    background: "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.88) 100%)",
                    height: "100%"
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6" fontWeight={700} sx={{ color: card.accent }}>
                        {card.title}
                      </Typography>
                      <Chip label={card.metric} size="small" sx={{ backgroundColor: "rgba(15, 23, 42, 0.06)" }} />
                    </Stack>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {card.text}
                    </Typography>
                    <Typography sx={{ color: "#475569" }}>{card.detail}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {card.bullets.map((bullet) => (
                        <Chip key={bullet} label={bullet} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Stack>

        <Paper className="glass" sx={{ mt: 4, p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
            Student-First Proof Points
          </Typography>
          <Grid container spacing={2}>
            {[
              "Level Up: Earn badges as you secure your accounts.",
              "No Lectures: No boring alerts. Just actionable insights and instant blocks.",
              "SQL Powered: Built on MySQL for students who want to see how the engine actually works."
            ].map((text) => (
              <Grid key={text} item xs={12} md={4}>
                <Typography sx={{ color: "#475569" }}>{text}</Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>

        <Paper
          className="glass"
          sx={{ mt: 4, p: 3, borderRadius: 4, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 2, border: "1px solid rgba(148, 163, 184, 0.25)" }}
        >
          <Typography sx={{ color: "#475569" }}>
            Compliance Ready: GDPR / CCPA / SOC2-lite
          </Typography>
          <Button component={Link} href="/db/schema.sql" variant="outlined" sx={{ borderColor: "#64ffda", color: "#64ffda" }}>
            Open Source Schema
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}
