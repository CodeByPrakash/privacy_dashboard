import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { assertActiveSession, getAuthFromCookieValue } from "@/lib/auth";
import ScoreGauge from "@/app/components/ScoreGauge";
import LineChart from "@/app/components/LineChart";
import BarChart from "@/app/components/BarChart";
import UrlCheckForm from "@/app/components/UrlCheckForm";
import AutoRefresh from "@/app/components/AutoRefresh";
import ExtensionTokenPanel from "@/app/components/ExtensionTokenPanel";
import {
  Container,
  Paper,
  Typography,
  Grid,
  Chip,
  Box,
  Stack,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Tooltip,
  IconButton,
  LinearProgress
} from "@mui/material";
import { redirect } from "next/navigation";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

export default async function StudentPage() {
  const cookieStore = cookies();
  const auth = await getAuthFromCookieValue(cookieStore.get("pd_session")?.value);
  if (!auth.userId) {
    redirect("/auth/signin");
  }

  const pool = getPool();
  try {
    await assertActiveSession(pool, auth.sessionId);
  } catch {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h4" fontWeight={700}>
            Student Dashboard
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Your session expired. Please sign in again.
          </Typography>
        </Paper>
      </Container>
    );
  }

  const [[user]] = await pool.query(
    "SELECT name, privacy_score, security_level, two_factor_enabled FROM students WHERE id = ? LIMIT 1",
    [auth.userId]
  );

  const [[weakPasswordRow]] = await pool.query(
    "SELECT COUNT(*) AS count FROM password_meta WHERE student_id = ? AND (length_check = FALSE OR complexity_check = FALSE OR pwned_check = TRUE OR (entropy_score IS NOT NULL AND entropy_score < 35.00)) AND (last_changed IS NULL OR last_changed < (CURRENT_DATE - INTERVAL 30 DAY))",
    [auth.userId]
  );

  const [[suspiciousRow]] = await pool.query(
    "SELECT COUNT(*) AS count FROM student_activity WHERE student_id = ? AND is_suspicious = TRUE AND visited_at >= (NOW() - INTERVAL 1 DAY)",
    [auth.userId]
  );

  const [recentSuspicious] = await pool.query(
    "SELECT url, visited_at FROM student_activity WHERE student_id = ? AND is_suspicious = TRUE ORDER BY visited_at DESC LIMIT 5",
    [auth.userId]
  );

  const [recentActivity] = await pool.query(
    "SELECT url, visited_at, is_suspicious FROM student_activity WHERE student_id = ? ORDER BY visited_at DESC LIMIT 10",
    [auth.userId]
  );

  const recentUrls = recentActivity.map((row) => row.url).filter(Boolean);
  const [blockedReasons] = recentUrls.length
    ? await pool.query(
        `SELECT url, threat_intel FROM blocked_sites WHERE url IN (${recentUrls
          .map(() => "?")
          .join(",")})`,
        recentUrls
      )
    : [[], []];

  const reasonMap = new Map(
    blockedReasons.map((row) => {
      const reason = row?.threat_intel?.reason || row?.threat_intel?.message || null;
      return [row.url, reason || "Blocked due to suspicious behavior."];
    })
  );

  const [[passwordMeta]] = await pool.query(
    "SELECT length_check, complexity_check, pwned_check, entropy_score, last_changed FROM password_meta WHERE student_id = ? ORDER BY updated_at DESC LIMIT 1",
    [auth.userId]
  );

  const [scoreHistory] = await pool.query(
    "SELECT privacy_score, recorded_at FROM privacy_score_history WHERE student_id = ? ORDER BY recorded_at DESC LIMIT 14",
    [auth.userId]
  );

  const [activityRows] = await pool.query(
    "SELECT DATE(visited_at) AS day, COUNT(*) AS count FROM student_activity WHERE student_id = ? AND visited_at >= (CURRENT_DATE - INTERVAL 6 DAY) GROUP BY DATE(visited_at) ORDER BY day",
    [auth.userId]
  );

  const [[suspiciousLast24]] = await pool.query(
    "SELECT COUNT(*) AS count FROM student_activity WHERE student_id = ? AND is_suspicious = TRUE AND visited_at >= (NOW() - INTERVAL 1 DAY)",
    [auth.userId]
  );

  const activityMap = new Map(activityRows.map((row) => [String(row.day), row.count]));
  const activityData = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const label = date.toLocaleDateString(undefined, { weekday: "short" });
    const key = date.toISOString().slice(0, 10);
    return { label, value: activityMap.get(key) || 0 };
  });

  const scoreData = [...scoreHistory]
    .reverse()
    .map((row) => ({
      label: new Date(row.recorded_at).toLocaleDateString(),
      value: Number(row.privacy_score)
    }));

  const entropy = Number(passwordMeta?.entropy_score || 0);
  const passwordWeak =
    !passwordMeta ||
    passwordMeta.length_check === 0 ||
    passwordMeta.complexity_check === 0 ||
    passwordMeta.pwned_check === 1 ||
    entropy < 35;

  const passwordModerate = !passwordWeak && entropy < 55;
  const passwordStrength = passwordWeak ? "Weak" : passwordModerate ? "Moderate" : "Strong";
  const passwordBadgeClass = passwordWeak
    ? "badge danger"
    : passwordModerate
      ? "badge warning"
      : "badge success";

  const lastChanged = passwordMeta?.last_changed ? new Date(passwordMeta.last_changed) : null;
  const daysSinceChange = lastChanged
    ? Math.floor((Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const vibeLevel =
    (user?.privacy_score ?? 0) >= 90
      ? "Platinum"
      : (user?.privacy_score ?? 0) >= 75
        ? "Gold"
        : (user?.privacy_score ?? 0) >= 55
          ? "Silver"
          : "Bronze";

  const badges = [];
  if (user?.two_factor_enabled) badges.push("2FA Enabled");
  if ((suspiciousRow?.count || 0) === 0) badges.push("Clean Browsing (24h)");
  if (passwordStrength === "Strong") badges.push("Strong Password");
  if (daysSinceChange !== null && daysSinceChange <= 30) badges.push("Recently Updated Password");

  const showClearHistory = (suspiciousRow?.count || 0) > 0;

  const actionItems = [];
  if ((weakPasswordRow?.count || 0) > 0) {
    actionItems.push("Change your weak password");
  }
  if ((suspiciousRow?.count || 0) > 0) {
    actionItems.push("Review suspicious site visits");
  }
  if (!user?.two_factor_enabled) {
    actionItems.push("Enable Two-Factor Authentication (2FA)");
  }

  const securityChipColor =
    user?.security_level === "high-risk"
      ? "error"
      : user?.security_level === "warning"
        ? "warning"
        : "success";

  const score = user?.privacy_score ?? 0;
  const levelBands = [
    { name: "Bronze", min: 0, max: 54, color: "#b45309" },
    { name: "Silver", min: 55, max: 74, color: "#64748b" },
    { name: "Gold", min: 75, max: 89, color: "#f59e0b" },
    { name: "Platinum", min: 90, max: 100, color: "#0ea5e9" }
  ];
  const currentLevel = levelBands.find((band) => score >= band.min && score <= band.max) || levelBands[0];
  const nextLevel = levelBands[levelBands.indexOf(currentLevel) + 1];
  const levelProgress = nextLevel
    ? Math.min(100, Math.round(((score - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100))
    : 100;
  const xpPoints = Math.round(score * 12);

  return (
    <Box sx={{ background: "radial-gradient(circle at top, rgba(56, 189, 248, 0.08), transparent 55%)" }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
      <AutoRefresh intervalMs={10000} />
      <Paper
        elevation={0}
        sx={{
          p: 3,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          borderRadius: 4,
          border: "1px solid rgba(148, 163, 184, 0.25)",
          background: "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))",
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)"
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Mission Control
          </Typography>
          <Typography color="text.secondary">Welcome back, {user?.name || "Student"}. Level up your privacy.</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
            <Chip
              label={`Level: ${currentLevel.name}${currentLevel.name === "Platinum" ? " ✦" : ""}`}
              sx={{ backgroundColor: "rgba(15, 23, 42, 0.06)", color: currentLevel.color }}
            />
            <Chip label={`XP ${xpPoints}`} sx={{ backgroundColor: "rgba(15, 23, 42, 0.06)" }} />
            <Chip label={user?.security_level || "unknown"} color={securityChipColor} />
          </Stack>
        </Box>
        <Box sx={{ minWidth: 240 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Level Progress {nextLevel ? `→ ${nextLevel.name}` : "(Max)"}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={levelProgress}
            sx={{ mt: 1, height: 10, borderRadius: 999, backgroundColor: "rgba(148, 163, 184, 0.25)",
              "& .MuiLinearProgress-bar": { backgroundColor: currentLevel.color } }}
          />
          <Typography variant="caption" color="text.secondary">
            {nextLevel ? `${score}/${nextLevel.min} to unlock` : "Top tier achieved"}
          </Typography>
        </Box>
      </Paper>

      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="overline" color="text.secondary">Core Score</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <ScoreGauge score={score} />
              <Box>
                <Typography variant="h5" fontWeight={700}>{score}</Typography>
                <Typography color="text.secondary">Privacy Score</Typography>
              </Box>
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Updated in real time from your activity logs.
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="overline" color="text.secondary">Daily Vibe</Typography>
            <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
              {(suspiciousLast24?.count || 0) === 0 ? "Ghost Streak" : "Heads Up"}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {(suspiciousLast24?.count || 0) === 0
                ? "You were a Ghost today! 0 trackers followed you."
                : `You had ${suspiciousLast24?.count || 0} suspicious hits in the last 24 hours.`}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
              <Chip label={`${badges.length} badges`} size="small" />
              <Chip label={`${recentActivity.length} recent logs`} size="small" />
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="overline" color="text.secondary">Action Queue</Typography>
            <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
              {actionItems.length === 0 ? "All clear" : `${actionItems.length} quests`}
            </Typography>
            {actionItems.length === 0 ? (
              <Typography color="text.secondary" sx={{ mt: 1 }}>Keep up the good habits.</Typography>
            ) : (
              <Stack spacing={1} sx={{ mt: 1 }}>
                {actionItems.map((item) => (
                  <Chip key={item} label={item} variant="outlined" />
                ))}
              </Stack>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "nowrap", justifyContent: "flex-end" }}>
              {passwordStrength === "Weak" ? (
                <Button
                  variant="contained"
                  color="warning"
                  href="/security/update"
                  sx={{
                    borderRadius: 99,
                    boxShadow: "0 10px 20px rgba(245, 158, 11, 0.35)",
                    textTransform: "none"
                  }}
                >
                  Update Password Now
                </Button>
              ) : null}
              <Button
                variant="outlined"
                href="/tools/password-checker"
                sx={{
                  borderRadius: 99,
                  borderStyle: "dashed",
                  textTransform: "none"
                }}
              >
                Check a Password
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>


      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <ExtensionTokenPanel />
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="h6" fontWeight={700}>
              Password Strength
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Chip label={passwordStrength} color={passwordWeak ? "error" : passwordModerate ? "warning" : "success"} />
              <Typography color="text.secondary">
                {daysSinceChange !== null ? `${daysSinceChange} days since change` : "No change date available"}
              </Typography>
            </Stack>
            <Typography color="text.secondary">
              Entropy score: {entropy ? entropy.toFixed(1) : "No entropy data yet"}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="h6" fontWeight={700}>
              Vibe Level
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {vibeLevel}
            </Typography>
            {badges.length === 0 ? (
              <Typography color="text.secondary">No badges yet.</Typography>
            ) : (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                {badges.map((badge) => (
                  <Chip key={badge} label={badge} color="success" size="small" />
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Paper id="suspicious-sites" elevation={0} sx={{ p: 3, mt: 2, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
        <Typography variant="h6" fontWeight={700}>
          Recent Suspicious Sites
        </Typography>
        {recentSuspicious.length === 0 ? (
          <Typography>No suspicious activity in your recent history.</Typography>
        ) : (
          <Box component="ul" sx={{ pl: 2 }}>
            {recentSuspicious.map((row) => (
              <li key={`${row.url}-${row.visited_at}`}>
                {row.url} ({new Date(row.visited_at).toLocaleString()})
              </li>
            ))}
          </Box>
        )}
      </Paper>

      <Grid id="web-activity" container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="h6" fontWeight={700}>
              Web Activity Monitor
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Log a URL visit to see if it is blocked and update your score.
            </Typography>
            <UrlCheckForm />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="h6" fontWeight={700}>
              Recent Activity
            </Typography>
            {recentActivity.length === 0 ? (
              <Typography>No recent activity.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>URL</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Why blocked?</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentActivity.map((row) => (
                    <TableRow key={`${row.url}-${row.visited_at}`}>
                      <TableCell>{row.url}</TableCell>
                      <TableCell>{row.is_suspicious ? "Blocked" : "Allowed"}</TableCell>
                      <TableCell>{new Date(row.visited_at).toLocaleString()}</TableCell>
                      <TableCell>
                        {row.is_suspicious ? (
                          <Tooltip title={reasonMap.get(row.url) || "Blocked for your safety."} arrow>
                            <IconButton size="small" color="primary">
                              <InfoOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Grid id="history" container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="h6" fontWeight={700}>
              Score History
            </Typography>
            <LineChart data={scoreData} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="h6" fontWeight={700}>
              Activity History (7 days)
            </Typography>
            <BarChart data={activityData} />
          </Paper>
        </Grid>
      </Grid>
    </Container>
    </Box>
  );
}
