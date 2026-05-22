import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ContractorPaymentsClient from "./contractor-payments-client";

export default async function ContractorPaymentsPage() {
  const session = await auth();
  if (!session?.user?.active) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const currentYear = new Date().getFullYear();

  const [users, payments] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.contractorPayment.findMany({
      where: {
        paymentDate: {
          gte: new Date(`${currentYear}-01-01`),
          lte: new Date(`${currentYear}-12-31T23:59:59`),
        },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { paymentDate: "desc" },
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <ContractorPaymentsClient
        users={users.map((u) => ({ ...u, name: u.name ?? "" }))}
        initialPayments={payments.map((p) => ({
          ...p,
          paymentDate: p.paymentDate.toISOString(),
          payPeriodStart: p.payPeriodStart?.toISOString() ?? null,
          payPeriodEnd: p.payPeriodEnd?.toISOString() ?? null,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          user: { ...p.user, name: p.user.name ?? "" },
        }))}
        currentYear={currentYear}
      />
    </div>
  );
}
