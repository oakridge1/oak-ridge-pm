import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OwnerDrawsClient from "./owner-draws-client";

export default async function OwnerDrawsPage() {
  const session = await auth();
  if (!session?.user?.active) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const currentYear = new Date().getFullYear();

  const [owners, draws] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ADMIN", active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.ownerDraw.findMany({
      where: {
        drawDate: {
          gte: new Date(`${currentYear}-01-01`),
          lte: new Date(`${currentYear}-12-31T23:59:59`),
        },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { drawDate: "desc" },
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <OwnerDrawsClient
        owners={owners.map((o) => ({ ...o, name: o.name ?? "" }))}
        initialDraws={draws.map((d) => ({
          ...d,
          drawDate: d.drawDate.toISOString(),
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
          user: { ...d.user, name: d.user.name ?? "" },
        }))}
        currentYear={currentYear}
      />
    </div>
  );
}
