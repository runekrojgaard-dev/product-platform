import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  async function authenticate(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: searchParams?.callbackUrl || "/dashboard",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/login?error=invalid`);
      }
      throw err;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-lg p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900 mb-1">Sign in</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Product Lifecycle &amp; Quality Platform
        </p>

        {searchParams?.error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            Invalid email or password.
          </div>
        )}

        <form action={authenticate} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-800"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-neutral-900 text-white text-sm font-medium py-2 hover:bg-neutral-800 transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
