import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { assertActiveSession, getAuthFromCookieValue, requireRole } from "@/lib/auth";
import Link from "next/link";
import LineChart from "@/app/components/LineChart";
import BarChart from "@/app/components/BarChart";
import AutoRefresh from "@/app/components/AutoRefresh";
import {
  Container,
  Paper,
  Typography,
  Chip,
  Stack,
  Button
} from "@mui/material";
import { redirect } from "next/navigation";

export default async function AdminPage() {
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

  const [[counts]] = await pool.query(
    "SELECT " +
      "(SELECT COUNT(*) FROM students) AS students, " +
      "(SELECT COUNT(*) FROM students WHERE security_level = 'high-risk') AS high_risk, " +
      "(SELECT COUNT(*) FROM web_filter_list WHERE status = 'Blocked') AS blocked_sites, " +
      "(SELECT COUNT(*) FROM web_filter_list WHERE status = 'Pending') AS pending_sites"
  );

  const [scoreHistory] = await pool.query(
    "SELECT DATE(recorded_at) AS day, AVG(privacy_score) AS avg_score FROM privacy_score_history GROUP BY DATE(recorded_at) ORDER BY day DESC LIMIT 14"
  );

  const [activityRows] = await pool.query(
    "SELECT DATE(visited_at) AS day, COUNT(*) AS count FROM student_activity WHERE visited_at >= (CURRENT_DATE - INTERVAL 6 DAY) GROUP BY DATE(visited_at) ORDER BY day"
  );

  const scoreData = [...scoreHistory]
    .reverse()
    .map((row) => ({ label: row.day.toISOString().slice(0, 10), value: Number(row.avg_score) }));

  const activityMap = new Map(activityRows.map((row) => [String(row.day), row.count]));
  const activityData = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const label = date.toLocaleDateString(undefined, { weekday: "short" });
    const key = date.toISOString().slice(0, 10);
    return { label, value: activityMap.get(key) || 0 };
  });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <AutoRefresh intervalMs={10000} />
      <Paper elevation={2} sx={{ p: 3, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <div>
          <Typography variant="h4" fontWeight={700}>
            Admin Dashboard
          </Typography>
          <Typography color="text.secondary">Overview of risks, sites, and activity.</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
            <Button component={Link} href="/admin/students" variant="outlined">Students</Button>
            <Button component={Link} href="/admin/activity" variant="outlined">Activity</Button>
            <Button component={Link} href="/admin/sites" variant="outlined">Sites</Button>
            <Button component={Link} href="/admin/agents" variant="outlined">Agent Controls</Button>
          </Stack>
        </div>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip label={`Students: ${counts?.students || 0}`} color="primary" />
          <Chip label={`High-risk: ${counts?.high_risk || 0}`} color="error" />
          <Chip label={`Blocked: ${counts?.blocked_sites || 0}`} color="warning" />
          <Chip label={`Pending: ${counts?.pending_sites || 0}`} color="secondary" />
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2 }}>
        <Paper elevation={1} sx={{ p: 3, flex: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            Average Score Trend
          </Typography>
          <LineChart data={scoreData} />
        </Paper>
        <Paper elevation={1} sx={{ p: 3, flex: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            Activity Volume (7 days)
          </Typography>
          <BarChart data={activityData} />
        </Paper>
      </Stack>
    </Container>
  );
}
