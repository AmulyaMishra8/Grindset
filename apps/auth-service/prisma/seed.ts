import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

// Seeds the shared, deliberately-public demo account used by the login page's
// "demo" button. It's an ordinary verified user with no special privileges.
// Safe to run repeatedly (upsert) — e.g. after pointing at a fresh Neon DB.
const prisma = new PrismaClient();

const DEMO = {
  email: "demo@grindset.dev",
  password: "grindset-demo-2026",
  displayName: "Demo User",
};

async function main() {
  const passwordHash = await hashPassword(DEMO.password);
  await prisma.user.upsert({
    where: { email: DEMO.email },
    update: { passwordHash, emailVerified: true },
    create: {
      email: DEMO.email,
      passwordHash,
      displayName: DEMO.displayName,
      emailVerified: true,
    },
  });
  console.log(`✅ Seeded demo account: ${DEMO.email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
