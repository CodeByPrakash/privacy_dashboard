import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { assertActiveSession, getAuthFromCookieValue, requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminBlockButton from "@/app/components/AdminBlockButton";
import BarChart from "@/app/components/BarChart";
import AutoRefresh from "@/app/components/AutoRefresh";
import {
  Container,
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack
} from "@mui/material";

export default async function AdminActivityPage() {
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

  const [recentActivity] = await pool.query(
    "SELECT url, COUNT(*) AS hits, MAX(visited_at) AS last_seen FROM student_activity GROUP BY url ORDER BY last_seen DESC LIMIT 50"
  );

  const [activityRows] = await pool.query(
    "SELECT DATE(visited_at) AS day, COUNT(*) AS count FROM student_activity WHERE visited_at >= (CURRENT_DATE - INTERVAL 6 DAY) GROUP BY DATE(visited_at) ORDER BY day"
  );

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
      <Stack spacing={2}>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
            Activity Volume (7 days)
          </Typography>
          <BarChart data={activityData} />
        </Paper>
        <Paper elevation={1} sx={{ p: 2 }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
            Recent Web Activity
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>URL</TableCell>
                <TableCell>Hits</TableCell>
                <TableCell>Last Seen</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentActivity.map((row) => (
                <TableRow key={row.url}>
                  <TableCell>{row.url}</TableCell>
                  <TableCell>{row.hits}</TableCell>
                  <TableCell>{new Date(row.last_seen).toLocaleString()}</TableCell>
                  <TableCell>
                    <AdminBlockButton url={row.url} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Stack>
    </Container>
  );
}
