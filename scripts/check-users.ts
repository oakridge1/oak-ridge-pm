import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true, active: true, role: true, name: true,
      accounts: { select: { provider: true, providerAccountId: true } }
    },
    orderBy: { createdAt: "asc" },
  });
  console.log("=== USERS + ACCOUNTS ===");
  for (const u of users) {
    const linked = u.accounts.length > 0 ? `LINKED (${u.accounts.map(a => a.provider).join(",")})` : "NO OAUTH LINK";
    console.log(`${u.email} | active=${u.active} | role=${u.role} | ${linked}`);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
