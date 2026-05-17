import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function FullscreenLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.active) redirect("/login");
  const canEstimate =
    session.user.role === "ADMIN" || (session.user as any).estimatingPermission === true;
  if (!canEstimate) redirect("/");
  return <>{children}</>;
}
