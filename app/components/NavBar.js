"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Stack,
  Chip,
  Container,
  IconButton,
  Menu,
  MenuItem,
  Box
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

export default function NavBar() {
  const [user, setUser] = useState(null);
  const pathname = usePathname();
  const [anchorEl, setAnchorEl] = useState(null);
  const isAdmin = user?.role === "admin" || user?.role === "super-admin";
  const openMenu = (event) => setAnchorEl(event.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  const loadUser = async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
      const data = await response.json();
      setUser(data.user || null);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    loadUser();
  }, [pathname]);

  useEffect(() => {
    const handler = (event) => {
      const detail = event?.detail;
      if (detail) {
        setUser(detail);
      } else {
        loadUser();
      }
    };
    window.addEventListener("pd-auth-changed", handler);
    return () => window.removeEventListener("pd-auth-changed", handler);
  }, []);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/";
  };

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.35)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)"
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ display: "flex", gap: 2, color: "#fff" }}>
          <Typography
            variant="h6"
            component={Link}
            href="/"
            sx={{
              color: "#000",
              textDecoration: "none",
              fontWeight: 700,
              mr: 2,
              flexGrow: { xs: 1, md: 0 }
            }}
          >
            Privacy Dashboard
          </Typography>

          <Box sx={{ display: { xs: "flex", md: "none" }, ml: "auto" }}>
            <IconButton color="inherit" onClick={openMenu} sx={{ color: "#000" }}>
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={closeMenu}
              PaperProps={{
                sx: {
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  color: "#000"
                }
              }}
            >
              {user ? (
                isAdmin ? (
                  <>
                    <MenuItem component={Link} href="/admin" onClick={closeMenu}>Admin Dashboard</MenuItem>
                    <MenuItem component={Link} href="/admin/students" onClick={closeMenu}>Students</MenuItem>
                    <MenuItem component={Link} href="/admin/activity" onClick={closeMenu}>Activity</MenuItem>
                    <MenuItem component={Link} href="/admin/sites" onClick={closeMenu}>Sites</MenuItem>
                    <MenuItem component={Link} href="/admin/agents" onClick={closeMenu}>Agent Controls</MenuItem>
                    <MenuItem component={Link} href="/tools/password-checker" onClick={closeMenu}>Password Checker</MenuItem>
                  </>
                ) : (
                  <>
                    <MenuItem component={Link} href="/student" onClick={closeMenu}>Student Dashboard</MenuItem>
                    <MenuItem component={Link} href="/tools/password-checker" onClick={closeMenu}>Password Checker</MenuItem>
                  </>
                )
              ) : null}
              {user ? (
                <MenuItem onClick={() => { closeMenu(); signOut(); }} sx={{ "&:hover": { backgroundColor: "rgba(255, 0, 0, 0.3)" } }}>Sign out</MenuItem>
              ) : (
                <>
                  <MenuItem component={Link} href="/auth/signin" onClick={closeMenu}>Sign In</MenuItem>
                  <MenuItem component={Link} href="/auth/register" onClick={closeMenu}>Register</MenuItem>
                  <MenuItem component={Link} href="/auth/register-admin" onClick={closeMenu}>Admin Register</MenuItem>
                </>
              )}
            </Menu>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flex: 1, display: { xs: "none", md: "flex" } }}>
            {user ? (
              isAdmin ? (
                <>
                  <Button color="inherit" component={Link} href="/admin" sx={{ color: "#000" }}>
                    Admin Dashboard
                  </Button>
                  <Button color="inherit" component={Link} href="/admin/students" sx={{ color: "#000" }}>
                    Students
                  </Button>
                  <Button color="inherit" component={Link} href="/admin/activity" sx={{ color: "#000" }}>
                    Activity
                  </Button>
                  <Button color="inherit" component={Link} href="/admin/sites" sx={{ color: "#000" }}>
                    Sites
                  </Button>
                  <Button color="inherit" component={Link} href="/admin/agents" sx={{ color: "#000" }}>
                    Agent Controls
                  </Button>
                  <Button color="inherit" component={Link} href="/tools/password-checker" sx={{ color: "#000" }}>
                    Password Checker
                  </Button>
                </>
              ) : (
                <>
                  <Button color="inherit" component={Link} href="/student" sx={{ color: "#000" }}>
                    Student Dashboard
                  </Button>
                  <Button color="inherit" component={Link} href="/tools/password-checker" sx={{ color: "#000" }}>
                    Password Checker
                  </Button>
                </>
              )
            ) : null}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: "none", md: "flex" } }}>
            {user ? (
              <>
                <Chip label={user.name} color="primary" size="small" />
                <Chip label={user.role} color="secondary" size="small" />
                <Button variant="outlined" color="inherit" onClick={signOut} sx={{ color: "red", borderColor: "rgba(0,0,0,0.4)" }}>
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button color="inherit" component={Link} href="/auth/signin" sx={{ color: "#000" }}>
                  Sign In
                </Button>
                <Button color="inherit" component={Link} href="/auth/register" sx={{ color: "#000" }}>
                  Register
                </Button>
                <Button color="inherit" component={Link} href="/auth/register-admin" sx={{ color: "#000" }}>
                  Admin Register
                </Button>
              </>
            )}
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
