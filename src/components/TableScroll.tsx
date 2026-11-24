import { MoveHorizontal } from "lucide-react";
import type { ReactNode } from "react";

export function TableScroll({ label, telugu, children }: { label: string; telugu: boolean; children: ReactNode }) {
  return <>
    <p className="g1-table-scroll-hint" aria-hidden="true">
      <MoveHorizontal size={17} />
      {telugu ? "మిగిలిన నిలువు వరుసల కోసం అడ్డంగా స్క్రోల్ చేయండి" : "Scroll sideways for more columns"}
    </p>
    <div className="g1-table-scroll overflow-x-auto" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  </>;
}
