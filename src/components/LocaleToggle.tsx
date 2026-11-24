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
  const nextLanguage = nextLocale === "te-IN" ? "తెలుగు" : "English";
  const switchLabel = nextLocale === "te-IN" ? "తెలుగు — Switch language to Telugu" : "English — ఆంగ్లంలోకి మార్చండి";

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
      className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#c3d7e5] bg-white px-2.5 py-1.5 text-xs font-bold text-[#1f3d59] transition-colors hover:bg-[#eef6fb]"
      aria-label={switchLabel}
      data-testid="locale-toggle"
    >
      <Globe className="h-4 w-4 shrink-0 text-[#007875]" aria-hidden="true" />
      <span lang={nextLocale === "te-IN" ? "te" : "en"}>{nextLanguage}</span>
    </button>
  );
}
