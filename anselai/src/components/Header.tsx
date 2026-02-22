import { auth, signOut } from "@/lib/auth";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pipeline": "Pipeline",
  "/contacts": "Contacts",
  "/calendar": "Calendar",
  "/tasks": "Tasks",
  "/settings": "Settings",
};

export default async function Header() {
  const session = await auth();
  const pathname = "/dashboard"; // Default for server component
  const title = "AnselAI";

  return (
    <header
      className="h-14 flex items-center justify-between px-6 md:px-8 shrink-0"
      style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-primary)" }}
    >
      <h1 className="text-base font-semibold md:ml-0 ml-12" style={{ color: "var(--text-primary)" }}>
        {title}
      </h1>
      {session?.user && (
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {session.user.email}
          </span>
          <form
            action={async () => {
              "use server"
              await signOut()
            }}
          >
            <button
              type="submit"
              className="text-sm px-3 py-1 rounded hover:bg-gray-100"
              style={{ color: "var(--text-secondary)" }}
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
