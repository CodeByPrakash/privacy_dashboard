import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db";
import { assertActiveSession, getAuthFromCookieValue, requireRole } from "@/lib/auth";
import ScoreGauge from "@/app/components/ScoreGauge";
import LineChart from "@/app/components/LineChart";
import BarChart from "@/app/components/BarChart";
import AdminResetLogsButton from "@/app/components/AdminResetLogsButton";
import AutoRefresh from "@/app/components/AutoRefresh";
import {
  Container,
  Paper,
  Typography,
  Stack,
  Chip,
  Grid,
  Box,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button
} from "@mui/material";
import Link from "next/link";

export default async function AdminStudentDashboardPage({ params }) {
  const cookieStore = cookies();
  const auth = await getAuthFromCookieValue(cookieStore.get("pd_session")?.value);

  if (!auth.userId) {
    redirect("/auth/signin");
  }

  const pool = getPool();
  try {
    await assertActiveSession(pool, auth.sessionId);
    if (!auth || !["admin", "super-admin"].includes(auth.role)) {
      requireRole("super-admin", auth);
    }
  } catch {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h4" fontWeight={700}>
            Admin Console
          </Typography>
          <Typography color="text.secondary">Access denied. Admin role required.</Typography>
        </Paper>
      </Container>
    );
  }

  const studentId = Number(params.id);
  if (!Number.isInteger(studentId)) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h4" fontWeight={700}>
            Student Dashboard
          </Typography>
          <Typography color="text.secondary">Invalid student id.</Typography>
        </Paper>
      </Container>
    );
  }

  const [[student]] = await pool.query(
    "SELECT id, student_id, name, privacy_score, security_level, two_factor_enabled FROM students WHERE id = ? LIMIT 1",
    [studentId]
  );

  if (!student) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h4" fontWeight={700}>
            Student Dashboard
          </Typography>
          <Typography color="text.secondary">Student not found.</Typography>
        </Paper>
      </Container>
    );
  }

  const [recentActivity] = await pool.query(
    "SELECT url, visited_at, is_suspicious FROM student_activity WHERE student_id = ? ORDER BY visited_at DESC LIMIT 10",
    [studentId]
  );

  const [recentSuspicious] = await pool.query(
    "SELECT url, visited_at FROM student_activity WHERE student_id = ? AND is_suspicious = TRUE ORDER BY visited_at DESC LIMIT 5",
    [studentId]
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
    [studentId]
  );

  const [scoreHistory] = await pool.query(
    "SELECT privacy_score, recorded_at FROM privacy_score_history WHERE student_id = ? ORDER BY recorded_at DESC LIMIT 14",
    [studentId]
  );

  const [activityRows] = await pool.query(
    "SELECT DATE(visited_at) AS day, COUNT(*) AS count FROM student_activity WHERE student_id = ? AND visited_at >= (CURRENT_DATE - INTERVAL 6 DAY) GROUP BY DATE(visited_at) ORDER BY day",
    [studentId]
  );

  const scoreData = [...scoreHistory]
    .reverse()
    .map((row) => ({ label: new Date(row.recorded_at).toLocaleDateString(), value: Number(row.privacy_score) }));

  const activityMap = new Map(activityRows.map((row) => [String(row.day), row.count]));
  const activityData = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const label = date.toLocaleDateString(undefined, { weekday: "short" });
    const key = date.toISOString().slice(0, 10);
    return { label, value: activityMap.get(key) || 0 };
  });

  const entropy = Number(passwordMeta?.entropy_score || 0);
  const passwordWeak =
    !passwordMeta ||
    passwordMeta.length_check === 0 ||
    passwordMeta.complexity_check === 0 ||
    passwordMeta.pwned_check === 1 ||
    entropy < 35;

  const passwordModerate = !passwordWeak && entropy < 55;
  const passwordStrength = passwordWeak ? "Weak" : passwordModerate ? "Moderate" : "Strong";

  const securityChipColor =
    student.security_level === "high-risk"
      ? "error"
      : student.security_level === "warning"
        ? "warning"
        : "success";

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <AutoRefresh intervalMs={10000} />
      <Paper elevation={1} sx={{ p: 3, mb: 2, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {student.name}
          </Typography>
          <Typography color="text.secondary">Student ID: {student.student_id}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
            <Chip label={student.security_level} color={securityChipColor} />
            {student.two_factor_enabled ? <Chip label="2FA Enabled" color="success" size="small" /> : null}
          </Stack>
        </Box>
        <Stack spacing={1} alignItems="flex-end">
          <Button component={Link} href="/admin/students" variant="outlined">
            Back to Students
          </Button>
          <AdminResetLogsButton studentId={student.id} />
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="overline" color="text.secondary">Privacy Score</Typography>
            <ScoreGauge score={student.privacy_score} />
            <Typography color="text.secondary">Current score: {student.privacy_score}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="overline" color="text.secondary">Password Strength</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip label={passwordStrength} color={passwordWeak ? "error" : passwordModerate ? "warning" : "success"} />
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Entropy score: {entropy ? entropy.toFixed(1) : "No entropy data yet"}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="overline" color="text.secondary">Recent Activity</Typography>
            <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
              {recentActivity.length} logs
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {recentSuspicious.length} suspicious hits in recent history.
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="h6" fontWeight={700}>Score History</Typography>
            <LineChart data={scoreData} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="h6" fontWeight={700}>Activity History (7 days)</Typography>
            <BarChart data={activityData} />
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="h6" fontWeight={700}>Recent Activity</Typography>
            {recentActivity.length === 0 ? (
              <Typography color="text.secondary">No recent activity.</Typography>
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
                      <TableCell>{row.is_suspicious ? reasonMap.get(row.url) || "Blocked" : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: "1px solid rgba(148, 163, 184, 0.25)" }}>
            <Typography variant="h6" fontWeight={700}>Recent Suspicious Sites</Typography>
            {recentSuspicious.length === 0 ? (
              <Typography color="text.secondary">No suspicious activity in recent history.</Typography>
            ) : (
              <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                {recentSuspicious.map((row) => (
                  <li key={`${row.url}-${row.visited_at}`}>
                    {row.url} ({new Date(row.visited_at).toLocaleString()})
                  </li>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
