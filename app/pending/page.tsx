import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { Clock, Zap } from "lucide-react";

export default async function PendingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.active) redirect("/");

  return (
    <div className="min-h-screen bg-[#002D72] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#002D72] px-8 py-8 text-center">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-xl bg-[#FF5910] flex items-center justify-center shadow-lg">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-white font-bold text-xl tracking-wide">
            OAK RIDGE ELECTRICAL
          </h1>
        </div>

        <div className="px-8 py-8 text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Awaiting Access
            </h2>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Your account ({session.user.email}) has been created. An admin
              needs to activate your account and assign your role before you can
              access the portal.
            </p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-sm text-gray-400 hover:text-gray-600 underline mt-2 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
