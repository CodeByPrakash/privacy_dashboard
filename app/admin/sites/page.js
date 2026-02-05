import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { assertActiveSession, getAuthFromCookieValue, requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import RefineButton from "@/app/components/RefineButton";
import ManualSiteEntryForm from "@/app/components/ManualSiteEntryForm";
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

export default async function AdminSitesPage() {
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

  const [pendingSites] = await pool.query(
    "SELECT url, category, status, updated_at FROM web_filter_list WHERE status = 'Pending' ORDER BY updated_at DESC LIMIT 100"
  );

  const [blockedSites] = await pool.query(
    "SELECT url, category, status, updated_at, threat_intel FROM web_filter_list WHERE status = 'Blocked' ORDER BY updated_at DESC LIMIT 100"
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <AutoRefresh intervalMs={10000} />
      <Stack spacing={2}>
        <ManualSiteEntryForm />
        <Paper elevation={1} sx={{ p: 2 }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
            Pending Sites
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>URL</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingSites.map((site) => (
                <TableRow key={site.url}>
                  <TableCell>{site.url}</TableCell>
                  <TableCell>{site.category}</TableCell>
                  <TableCell>{site.status}</TableCell>
                  <TableCell>
                    <RefineButton url={site.url} status={site.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Paper elevation={1} sx={{ p: 2 }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
            Blocked Sites
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>URL</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {blockedSites.map((site) => (
                <TableRow key={site.url}>
                  <TableCell>{site.url}</TableCell>
                  <TableCell>{site.category}</TableCell>
                  <TableCell>{new Date(site.updated_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {site.threat_intel ? (
                      <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                        {JSON.stringify(site.threat_intel, null, 2)}
                      </pre>
                    ) : (
                      <Typography color="text.secondary">None</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <RefineButton url={site.url} status={site.status} />
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
