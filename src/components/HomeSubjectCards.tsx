"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PointerEvent } from "react";
import { subjectCatalogueHref } from "@/lib/lab-discovery";
import type { LabSubject } from "@/lib/types";

function move(event: PointerEvent<HTMLAnchorElement>) {
  if (event.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const card = event.currentTarget;
  const { x, y, width, height } = card.parentElement!.getBoundingClientRect();
  card.style.setProperty("--subject-tilt-x", `${(.5 - (event.clientY - y) / height) * 9}deg`);
  card.style.setProperty("--subject-tilt-y", `${((event.clientX - x) / width - .5) * 11}deg`);
}

function reset(event: PointerEvent<HTMLAnchorElement>) {
  event.currentTarget.style.removeProperty("--subject-tilt-x");
  event.currentTarget.style.removeProperty("--subject-tilt-y");
}

export function HomeSubjectCards({ cards, grade, current, fixedClass }: {
  cards: { subject: LabSubject; title: string; description: string }[];
  grade?: number;
  current?: LabSubject;
  fixedClass?: boolean;
}) {
  return (
    <ul className="g1-home-subjects">
      {cards.map(({ subject, title, description }) => <li key={subject}>
        <Link href={subjectCatalogueHref(subject, grade, fixedClass)}
          aria-current={current === subject ? "page" : undefined} className={`g1-home-subject g1-home-subject-${subject}`}
          data-testid={`home-subject-${subject}`}
          onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}>
          <Image src={`/assets/homepage/${subject}.webp`} fill alt="" loading="eager"
            sizes="(max-width: 640px) 100vw, 33vw" />
          <div className="g1-home-subject-copy">
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <span className="g1-home-subject-arrow" aria-hidden="true"><ArrowRight size={25} /></span>
        </Link>
      </li>)}
    </ul>
  );
}
