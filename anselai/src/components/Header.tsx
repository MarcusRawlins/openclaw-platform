"use client";

import { usePathname } from "next/navigation";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/pipeline": "Pipeline",
  "/contacts": "Contacts",
  "/calendar": "Calendar",
  "/tasks": "Tasks",
  "/settings": "Settings",
};

export default function Header() {
  const pathname = usePathname();
  const title = Object.entries(titles).find(([k]) => pathname.startsWith(k))?.[1] ?? "AnselAI";

  return (
    <header
      className="h-14 flex items-center px-6 md:px-8 shrink-0"
      style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-primary)" }}
    >
      <h1 className="text-base font-semibold md:ml-0 ml-12" style={{ color: "var(--text-primary)" }}>
        {title}
      </h1>
    </header>
  );
}
