import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { roleHasPermission } from "@/lib/permissions";
import { ScanClient } from "./scan-client";

export default async function ScanPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!roleHasPermission(session.user.role, "product.view")) redirect("/dashboard");

  return <ScanClient />;
}
