import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold text-neutral-900">Profile</h1>
      <dl className="mt-4 bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100 max-w-sm">
        <div className="flex px-4 py-3 text-sm">
          <dt className="w-24 text-neutral-500">Name</dt>
          <dd className="text-neutral-900">{session.user.name}</dd>
        </div>
        <div className="flex px-4 py-3 text-sm">
          <dt className="w-24 text-neutral-500">Email</dt>
          <dd className="text-neutral-900">{session.user.email}</dd>
        </div>
        <div className="flex px-4 py-3 text-sm">
          <dt className="w-24 text-neutral-500">Role</dt>
          <dd className="text-neutral-900">{session.user.role.replace(/_/g, " ")}</dd>
        </div>
      </dl>
    </div>
  );
}
