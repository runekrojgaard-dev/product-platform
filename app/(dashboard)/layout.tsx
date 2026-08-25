import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { roleHasPermission } from "@/lib/permissions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", permission: null },
  { href: "/products", label: "Products", permission: "product.view" as const },
  { href: "/projects", label: "Projects", permission: "project.view" as const },
  { href: "/quality", label: "Quality", permission: "observation.view" as const },
  { href: "/reports", label: "Reports", permission: "report.view" as const },
  { href: "/admin/users", label: "Administration", permission: "admin.users.manage" as const },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="flex">
        <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-neutral-200 bg-white min-h-screen">
          <div className="px-5 py-5 border-b border-neutral-200">
            <p className="text-sm font-semibold text-neutral-900">Product Platform</p>
            <p className="text-xs text-neutral-500 mt-0.5">{session.user.name}</p>
            <p className="text-xs text-neutral-400">{role.replace(/_/g, " ")}</p>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-1">
            {NAV_ITEMS.filter(
              (item) => item.permission === null || roleHasPermission(role, item.permission)
            ).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2 rounded text-sm text-neutral-700 hover:bg-neutral-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
            className="p-3 border-t border-neutral-200"
          >
            <button className="w-full text-left text-sm text-neutral-500 hover:text-neutral-900 px-3 py-2">
              Sign out
            </button>
          </form>
        </aside>

        <main className="flex-1 min-h-screen pb-16 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-neutral-200 flex justify-around py-2">
        <Link href="/dashboard" className="text-xs text-neutral-600 flex flex-col items-center gap-1">
          Home
        </Link>
        <Link href="/search" className="text-xs text-neutral-600 flex flex-col items-center gap-1">
          Search
        </Link>
        <Link
          href="/scan"
          className="text-xs font-semibold text-white bg-neutral-900 rounded-full px-4 py-2 -mt-4 shadow-lg"
        >
          Scan
        </Link>
        <Link href="/add" className="text-xs text-neutral-600 flex flex-col items-center gap-1">
          Add
        </Link>
        <Link href="/profile" className="text-xs text-neutral-600 flex flex-col items-center gap-1">
          Profile
        </Link>
      </nav>
    </div>
  );
}
