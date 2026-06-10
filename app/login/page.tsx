import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginButton } from "./login-button";
import { Zap } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email is linked to a different sign-in method. Contact your admin.",
  OAuthSignin: "Could not start the Google sign-in flow. Please try again.",
  OAuthCallback: "Error during Google sign-in. Please try again.",
  Signin: "Sign-in failed. Please try again.",
  default: "Something went wrong during sign-in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await auth();
  if (session?.user?.active) redirect("/");
  if (session?.user && !session.user.active) redirect("/pending");

  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default)
    : null;

  return (
    <div className="min-h-screen bg-[#1e3a8a] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header band */}
        <div className="bg-[#1e3a8a] px-8 py-8 text-center">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-xl bg-[#FF5910] flex items-center justify-center shadow-lg">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-white font-bold text-xl tracking-wide">
            OAK RIDGE ELECTRICAL
          </h1>
          <p className="text-blue-300 text-xs mt-1 tracking-widest uppercase">
            Project Management
          </p>
        </div>

        {/* Login area */}
        <div className="px-8 py-8 flex flex-col items-center gap-4">
          <p className="text-gray-600 text-sm text-center leading-relaxed">
            Sign in with your Oak Ridge Google account to access the portal.
          </p>
          {errorMessage && (
            <div className="w-full bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 text-center">
              {errorMessage}
            </div>
          )}
          <LoginButton />
          <p className="text-xs text-gray-400 text-center mt-2">
            New accounts require admin approval before access is granted.
          </p>
        </div>
      </div>

      <p className="mt-6 text-blue-300 text-xs">
        &copy; {new Date().getFullYear()} Oak Ridge Electrical LLC
      </p>
    </div>
  );
}
