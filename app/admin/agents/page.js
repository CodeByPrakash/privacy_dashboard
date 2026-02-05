import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { assertActiveSession, getAuthFromCookieValue, requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import AgentControls from "@/app/components/AgentControls";
import AutoRefresh from "@/app/components/AutoRefresh";
import { Container, Paper, Typography } from "@mui/material";

export default async function AdminAgentsPage() {
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <AutoRefresh intervalMs={10000} />
      <Paper elevation={1} sx={{ p: 2 }}>
        <AgentControls />
      </Paper>
    </Container>
  );
}
