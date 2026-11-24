"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import type { Locale } from "@/lib/types";

interface LocaleToggleProps {
  locale: Locale;
}

export function LocaleToggle({ locale }: LocaleToggleProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const nextLocale: Locale = locale === "en-IN" ? "te-IN" : "en-IN";

  async function handleToggle() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={busy}
      className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#c3d7e5] bg-white px-2.5 py-1.5 text-xs font-bold text-[#1f3d59] transition-colors hover:bg-[#eef6fb] lg:px-3.5 lg:text-sm"
      aria-label={
        locale === "en-IN"
          ? "English / తెలుగు — Switch language to Telugu"
          : "తెలుగు / English — Switch language to English"
      }
      data-testid="locale-toggle"
    >
      <Globe className="h-4 w-4 shrink-0 text-[#007875]" aria-hidden="true" />
      <span className="hidden sm:inline">
        {locale === "en-IN" ? "English / తెలుగు" : "తెలుగు / English"}
      </span>
      <span className="sm:hidden">
        {locale === "en-IN" ? "తెలుగు" : "English"}
      </span>
    </button>
  );
}
