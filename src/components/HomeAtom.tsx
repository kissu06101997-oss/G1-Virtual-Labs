"use client";

import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";
import type { mountHomeAtom } from "./home-atom-scene";

export function HomeAtom({ imageDescription, children }: {
  imageDescription: string;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof mountHomeAtom>>(undefined);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    let loading = false;
    let generation = 0;

    async function start() {
      if (!inView || loading || controller.current || motion.matches) return;
      const requested = ++generation;
      loading = true;
      try {
        const { mountHomeAtom } = await import("./home-atom-scene");
        if (requested !== generation) return;
        controller.current = mountHomeAtom(container!);
        controller.current?.setVisible(inView);
      } catch {
        // The still atom remains visible if WebGL or the renderer chunk is unavailable.
      } finally {
        if (requested === generation) loading = false;
      }
    }

    function preferenceChanged() {
      if (motion.matches) {
        generation++;
        loading = false;
        controller.current?.dispose();
        controller.current = undefined;
      } else void start();
    }

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      controller.current?.setVisible(inView);
      if (inView) void start();
    });
    observer.observe(container);
    motion.addEventListener("change", preferenceChanged);
    return () => {
      generation++;
      observer.disconnect();
      motion.removeEventListener("change", preferenceChanged);
      controller.current?.dispose();
      controller.current = undefined;
    };
  }, []);

  return <>
    <div className="g1-home-hero" data-testid="home-science-image">
      <div className="g1-home-hero-track">
        <Image src="/assets/homepage/science-bench.webp" fill preload sizes="100vw" alt={imageDescription} />
        <div ref={host} className="g1-home-atom" aria-hidden="true" data-testid="hero-atom">
          <Image className="g1-atom-still" src="/assets/homepage/atom-still.webp" fill alt="" loading="eager" sizes="230px" />
        </div>
      </div>
    </div>
    {children}
  </>;
}
