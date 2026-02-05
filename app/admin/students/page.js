import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { assertActiveSession, getAuthFromCookieValue, requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import RevokeButton from "@/app/components/RevokeButton";
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
  Button
} from "@mui/material";

export default async function AdminStudentsPage() {
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

  const [students] = await pool.query(
    "SELECT id, student_id, name, privacy_score, security_level FROM students ORDER BY privacy_score ASC LIMIT 100"
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <AutoRefresh intervalMs={10000} />
      <Paper elevation={1} sx={{ p: 2 }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
          Students
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Student</TableCell>
              <TableCell>Student ID</TableCell>
              <TableCell>Score</TableCell>
              <TableCell>Security Level</TableCell>
              <TableCell>View</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell>{student.name}</TableCell>
                <TableCell>{student.student_id}</TableCell>
                <TableCell>{student.privacy_score}</TableCell>
                <TableCell>{student.security_level}</TableCell>
                <TableCell>
                  <Button
                    component={Link}
                    href={`/admin/students/${student.id}`}
                    variant="outlined"
                    size="small"
                  >
                    View
                  </Button>
                </TableCell>
                <TableCell>
                  <RevokeButton studentId={student.id} securityLevel={student.security_level} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Container>
  );
}
