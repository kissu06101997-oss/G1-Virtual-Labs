import Link from "next/link";
import { LayoutDashboard, UserRound } from "lucide-react";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function StudentAccountNav({ locale, current }: {
  locale: Locale;
  current: "profile" | "dashboard";
}) {
  const te = locale === "te-IN";
  const items = [
    { id: "profile", href: "/student/profile", label: te ? "ప్రొఫైల్" : "Profile", Icon: UserRound },
    { id: "dashboard", href: "/student", label: getDictionary(locale).nav.dashboard, Icon: LayoutDashboard },
  ];

  return (
    <nav aria-label={te ? "విద్యార్థి ఖాతా" : "Student account"} className="mb-5 flex flex-wrap gap-3">
      {items.map(({ id, href, label, Icon }) => (
        <Link
          key={id}
          href={href}
          aria-current={current === id ? "page" : undefined}
          className={`g1-btn min-h-11 px-4 text-sm ${current === id ? "g1-btn-teal" : "g1-btn-outline"}`}
        >
          <Icon size={17} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
