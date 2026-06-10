import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginButton } from "./login-button";

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
          <div className="flex justify-center">
            <img
              src="/White-ridge-logo.png"
              alt="Ridgeline"
              style={{ width: '200px', height: 'auto' }}
            />
          </div>
        </div>

        {/* Login area */}
        <div className="px-8 py-8 flex flex-col items-center gap-4">
          <p className="text-gray-600 text-sm text-center leading-relaxed">
            Sign in with your company Google account to access the portal.
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
        &copy; {new Date().getFullYear()} Ridgeline
      </p>
    </div>
  );
}
