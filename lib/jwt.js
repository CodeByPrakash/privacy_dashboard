import { SignJWT, jwtVerify } from "jose";

const issuer = "privacy-dashboard";
const audience = "privacy-dashboard-users";

function getSecret() {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function signJwt(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyJwt(token) {
  return jwtVerify(token, getSecret(), { issuer, audience });
}
