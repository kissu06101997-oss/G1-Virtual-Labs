import Link from "next/link";
import {
  BarChart3,
  ClipboardList,
  FlaskConical,
  HelpCircle,
  LayoutGrid,
} from "lucide-react";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

interface TeacherSidebarProps {
  active: "classes" | "assignments" | "reports";
  locale: Locale;
  schoolName: string | null;
}

export function TeacherSidebar({ active, locale, schoolName }: TeacherSidebarProps) {
  const dict = getDictionary(locale);
  const isTe = locale === "te-IN";

  const linkClass = (isActive: boolean) => isActive ? "g1-dashboard-nav-active" : "g1-dashboard-nav-link";

  return (
    <aside
      aria-label={dict.teacher.sidebarHeading}
      className="g1-dashboard-sidebar px-4 py-5 lg:w-[220px] lg:shrink-0"
    >
      <div className="px-2 pb-4">
        <div className="g1-eyebrow">
          {dict.teacher.sidebarHeading}
        </div>
        <div className="g1-dashboard-scope mt-3 p-3.5">
          <div className="text-xs font-semibold text-[#38546c]">
            {isTe ? "ప్రస్తుత పాఠశాల పరిధి" : "Current scope"}
          </div>
          <div className="mt-0.5 text-sm font-extrabold">
            {schoolName || (isTe ? "G1 పాఠశాల" : "G1 Partner School")}
          </div>
        </div>
      </div>

      <nav aria-label="Teacher sections" className="flex flex-wrap gap-1.5 lg:flex-col">
        <Link href="/teacher" className={linkClass(active === "classes")} aria-current={active === "classes" ? "page" : undefined}>
          <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          <span>{dict.nav.classes}</span>
        </Link>
        <Link href="/teacher/assignments" className={linkClass(active === "assignments")} aria-current={active === "assignments" ? "page" : undefined}>
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          <span>{dict.nav.assignments}</span>
        </Link>
        <Link href="/teacher/reports" className={linkClass(active === "reports")} aria-current={active === "reports" ? "page" : undefined}>
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          <span>{dict.nav.reports}</span>
        </Link>
        <Link href="/laboratories" className={linkClass(false)}>
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
          <span>{dict.nav.library}</span>
        </Link>
        <Link href="/help" className={linkClass(false)}>
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
          <span>{dict.nav.help}</span>
        </Link>
      </nav>
    </aside>
  );
}
