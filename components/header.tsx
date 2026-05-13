"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Settings, Zap } from "lucide-react";
import type { Role } from "@/app/generated/prisma/client";

interface HeaderProps {
  userName?: string | null;
  userRole?: Role;
  userImage?: string | null;
}

export function Header({ userName, userRole, userImage }: HeaderProps) {
  const pathname = usePathname();
  const isAdmin = userRole === "ADMIN";

  return (
    <header className="bg-[#002D72] text-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">

        {/* Logo — plain <img> to avoid Next.js image optimization issues with OneDrive */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 shrink-0 relative">
            <img
              src="/logo.jpg"
              alt="Oak Ridge Electrical"
              width={36}
              height={36}
              className="object-contain w-9 h-9"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                const fallback = (e.currentTarget as HTMLImageElement)
                  .nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = "flex";
              }}
            />
            <div
              className="absolute inset-0 w-9 h-9 rounded-md bg-[#FF5910] items-center justify-center"
              style={{ display: "none" }}
            >
              <Zap className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="font-bold text-sm tracking-wide">OAK RIDGE</div>
            <div className="text-[10px] text-blue-200 tracking-widest uppercase">Electrical LLC</div>
          </div>
        </Link>

        {/* Right nav */}
        <nav className="flex items-center gap-1.5">
          {isAdmin && (
            <Link
              href="/admin/users"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-white/20 text-white"
                  : "text-blue-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          {/* User avatar */}
          {userImage ? (
            <img
              src={userImage}
              alt={userName ?? "User"}
              className="w-8 h-8 rounded-full border-2 border-white/30 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#FF5910] flex items-center justify-center text-white text-sm font-bold shrink-0">
              {userName?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
          )}
          <span className="hidden md:block text-sm text-blue-100 max-w-[120px] truncate">
            {userName}
          </span>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 rounded-lg text-blue-200 hover:bg-white/10 hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </nav>
      </div>
    </header>
  );
}
