"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export default function RouteError({ reset }: { reset: () => void }) {
  const path = usePathname();
  const te = typeof document !== "undefined" && document.documentElement.lang === "te";
  return <main id="main-content" className="g1-public-shell g1-premium">
    <div className="g1-card g1-info-card g1-welcome" role="alert">
      <h1 className="g1-section-title">{te ? "ఈ పేజీ తెరవలేకపోయాము" : "This page couldn’t load"}</h1>
      <p>{te ? "కనెక్షన్ తనిఖీ చేసి మళ్లీ ప్రయత్నించండి." : "Check your connection and try again."}</p>
      <button type="button" className="g1-btn g1-btn-teal" onClick={reset}>{te ? "మళ్లీ ప్రయత్నించండి" : "Try again"}</button>
      {path !== "/" && <Link className="g1-text-link" href="/">{te ? "ముఖ పేజీ" : "Back to home"}</Link>}
    </div>
  </main>;
}
