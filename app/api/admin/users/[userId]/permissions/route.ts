export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { grantPermission, revokePermission, PERMISSION_KEYS } from "@/lib/permissions";
import type { PermissionKey } from "@/lib/permissions";

type Params = { params: Promise<{ userId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN")
    return new NextResponse("Forbidden", { status: 403 });
  const { userId } = await params;

  const [perms, user] = await Promise.all([
    prisma.userPermission.findMany({ where: { userId }, select: { permission: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { estimatingPermission: true } }),
  ]);

  return NextResponse.json({
    permissions: perms.map((p) => p.permission),
    estimatingPermission: user?.estimatingPermission ?? false,
  });
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN")
    return new NextResponse("Forbidden", { status: 403 });
  const { userId } = await params;
  const body = await req.json();
  const { permission, granted } = body as { permission: string; granted: boolean };

  if (!permission) return new NextResponse("Missing permission", { status: 400 });

  // ESTIMATING is stored as a boolean column on User, not in UserPermission table
  if (permission === "ESTIMATING") {
    await prisma.user.update({ where: { id: userId }, data: { estimatingPermission: !!granted } });
    return NextResponse.json({ ok: true });
  }

  if (!PERMISSION_KEYS.includes(permission as PermissionKey))
    return new NextResponse("Unknown permission", { status: 400 });

  if (granted) {
    await grantPermission(userId, permission as PermissionKey, session.user.id!);
  } else {
    await revokePermission(userId, permission as PermissionKey);
  }

  return NextResponse.json({ ok: true });
}
