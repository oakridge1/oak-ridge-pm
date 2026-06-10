"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Settings, Calculator, ClipboardList, User } from "lucide-react";
import type { Role } from "@/app/generated/prisma/client";

interface HeaderProps {
  userName?: string | null;
  userRole?: Role;
  userImage?: string | null;
  canEstimate?: boolean;
}

export function Header({ userName, userRole, userImage, canEstimate }: HeaderProps) {
  const pathname = usePathname();
  const isAdmin = userRole === "ADMIN";

  return (
    <header className="bg-[#1e3a8a] text-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">

        {/* Logo — plain <img> to avoid Next.js image optimization issues with OneDrive */}
        <Link href="/" className="flex items-center shrink-0">
          <img
            src="/White-ridge-logo.png"
            alt="Ridgeline"
            style={{ width: '160px', height: 'auto' }}
          />
        </Link>

        {/* Right nav */}
        <nav className="flex items-center gap-1.5">
          {canEstimate && (
            <Link
              href="/estimating"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname.startsWith("/estimating")
                  ? "bg-white/20 text-white"
                  : "text-blue-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span className="hidden sm:inline">Estimating</span>
            </Link>
          )}
          {canEstimate && (
            <Link
              href="/estimator"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname.startsWith("/estimator")
                  ? "bg-white/20 text-white"
                  : "text-blue-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Estimator</span>
            </Link>
          )}
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

          <Link
            href="/profile"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              pathname === "/profile"
                ? "bg-white/20 text-white"
                : "text-blue-200 hover:bg-white/10 hover:text-white"
            }`}
            title="My Profile"
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>

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
