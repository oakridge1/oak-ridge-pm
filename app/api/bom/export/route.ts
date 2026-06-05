export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const items = await prisma.bomItem.findMany({ orderBy: [{ cat: "asc" }, { id: "asc" }] });

  const rows = items.map(item => ({
    ID:       item.id,
    Category: item.cat,
    Name:     item.name,
    Unit:     item.unit,
    "Base $": item.mat,
    "Labor hrs": item.lhr,
    Markup:   item.mk,
    GC:       item.gc ? "Y" : "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BOM");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bom-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
