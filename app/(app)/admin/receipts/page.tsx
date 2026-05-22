import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ReceiptManagerClient } from "./receipt-manager-client";

export default async function AdminReceiptsPage() {
  const session = await auth();
  if (!session?.user?.active) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") redirect("/");

  const [receipts, jobs, users, vehicles] = await Promise.all([
    prisma.receipt.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        job: { select: { jobNumber: true, jobName: true } },
        uploadedBy: { select: { name: true } },
        vehicle: { select: { tag: true } },
      },
    }),
    prisma.job.findMany({
      orderBy: [{ jobNumber: "asc" }],
      select: { id: true, jobNumber: true, jobName: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.vehicle.findMany({
      where: { isActive: true },
      orderBy: { tag: "asc" },
      select: { id: true, tag: true },
    }),
  ]);

  const serialized = receipts.map((r) => ({
    id: r.id,
    type: r.type,
    vendor: r.vendor,
    amount: r.amount,
    receiptDate: r.receiptDate?.toISOString() ?? null,
    description: r.description,
    imageUrl: r.imageUrl,
    jobId: r.jobId,
    job: r.job ? { jobNumber: r.job.jobNumber, jobName: r.job.jobName } : null,
    uploadedBy: r.uploadedBy ? { name: r.uploadedBy.name } : null,
    vehicleId: r.vehicleId,
    vehicle: r.vehicle ? { tag: r.vehicle.tag } : null,
    mileage: r.mileage,
    isFuel: r.isFuel,
    flagged: r.flagged,
    flagReason: r.flagReason,
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    notes: r.notes,
    category: r.category,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002D72]">Receipt Manager</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review, categorize, and manage all submitted receipts.
        </p>
      </div>

      {/* Admin nav */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 pb-4 flex-wrap">
        <a
          href="/admin/users"
          className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors"
        >
          Users
        </a>
        <a
          href="/admin/saved-tasks"
          className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors"
        >
          Saved Tasks
        </a>
        <a
          href="/admin/receipts"
          className="text-sm font-medium text-[#002D72] border-b-2 border-[#002D72] pb-1 -mb-5"
        >
          Receipts
        </a>
        <a
          href="/admin/settings"
          className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors"
        >
          Settings
        </a>
        <a
          href="/admin/overhead"
          className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors"
        >
          Overhead
        </a>
        <a
          href="/admin/owner-draws"
          className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors"
        >
          Owner Draws
        </a>
        <a
          href="/admin/contractor-payments"
          className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors"
        >
          Contractor Pay
        </a>
      </div>

      <ReceiptManagerClient
        initialReceipts={serialized}
        jobs={jobs}
        users={users}
        vehicles={vehicles}
      />
    </div>
  );
}
