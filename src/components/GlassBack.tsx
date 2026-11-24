import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function GlassBack({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="g1-btn g1-btn-outline g1-glass-back">
    <ArrowLeft size={17} aria-hidden="true" /> {label}
  </Link>;
}
