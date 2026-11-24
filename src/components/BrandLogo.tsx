"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const LOGO_SRC = "/brand/g1-virtual-labs.svg";
const INTERACTIVE_LOGO =
  "(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  const surface = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = surface.current;
    if (!host) return;

    const preference = window.matchMedia(INTERACTIVE_LOGO);
    let controller: AbortController | undefined;
    let dispose: (() => void) | undefined;
    let cancelIdle: (() => void) | undefined;

    function stop() {
      cancelIdle?.();
      controller?.abort();
      dispose?.();
      cancelIdle = undefined;
      controller = undefined;
      dispose = undefined;
    }

    function start() {
      stop();
      if (!preference.matches) return;

      const load = async () => {
        const request = new AbortController();
        controller = request;

        try {
          const [response, { renderGlossyLogo }] = await Promise.all([
            fetch(LOGO_SRC, { signal: request.signal }),
            import("./brand-logo-scene"),
          ]);
          if (!response.ok) return;
          const svg = await response.text();
          if (host && !request.signal.aborted) dispose = renderGlossyLogo(host, svg);
        } catch {
          // The vector logo is already rendered when graphics initialization fails.
        }
      };

      if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(() => void load(), { timeout: 1500 });
        cancelIdle = () => window.cancelIdleCallback(id);
      } else {
        const id = globalThis.setTimeout(() => void load(), 180);
        cancelIdle = () => globalThis.clearTimeout(id);
      }
    }

    start();
    preference.addEventListener("change", start);
    return () => {
      preference.removeEventListener("change", start);
      stop();
    };
  }, []);

  return (
    <Link
      href="/"
      className="inline-flex shrink-0 items-center rounded-lg focus-visible:outline-offset-4"
      aria-label="G1 Virtual Labs — Home"
    >
      <span
        ref={surface}
        className={`g1-brand-logo ${
          compact
            ? "w-[144px] sm:w-[172px] lg:w-[189px]"
            : "w-[144px] sm:w-[164px] md:w-[174px] lg:w-[222px]"
        }`}
      >
        <img
          className="g1-brand-logo__fallback"
          src={LOGO_SRC}
          alt="G1 Virtual Labs"
          width={650}
          height={110}
          draggable={false}
        />
      </span>
    </Link>
  );
}
