"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cpu, Loader2, Monitor, RefreshCw, Wifi } from "lucide-react";
import type { Locale } from "@/lib/types";

interface HealthPayload {
  status: string;
  database: string;
  experimentVersions?: number;
  engineAbi?: string;
  optionalTutorEnabled?: boolean;
}

interface DeviceCapabilityPanelProps {
  locale?: Locale;
}

export function DeviceCapabilityPanel({ locale = "en-IN" }: DeviceCapabilityPanelProps) {
  const isTe = locale === "te-IN";

  const [webgl2, setWebgl2] = useState<string>(isTe ? "తనిఖీ చేస్తోంది..." : "Checking...");
  const [viewport, setViewport] = useState<string>(isTe ? "తనిఖీ చేస్తోంది..." : "Checking...");
  const [reducedMotion, setReducedMotion] = useState<string>(isTe ? "తనిఖీ చేస్తోంది..." : "Checking...");
  const [online, setOnline] = useState<boolean>(true);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [checkState, setCheckState] = useState<"idle" | "checking" | "updated" | "error">("idle");
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const refreshChecks = useCallback(async () => {
    setCheckState("checking");

    if (typeof window !== "undefined") {
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2");
        setWebgl2(
          gl
            ? isTe
              ? "WebGL2 అందుబాటులో ఉంది (+ 2D యాక్సెసిబుల్ DOM ప్లేయర్)"
              : "WebGL2 available (+ 2D Accessible DOM player parity)"
            : isTe
              ? "WebGL2 అందుబాటులో లేదు — 2D యాక్సెసిబుల్ DOM ప్లేయర్ ఉపయోగించండి"
              : "WebGL2 unavailable — use 2D Accessible DOM player"
        );
      } catch {
        setWebgl2(
          isTe
            ? "WebGL2 తనిఖీ నిరోధించబడింది — 2D DOM ప్లేయర్ సిఫార్సు చేయబడింది"
            : "WebGL2 check blocked — 2D Accessible DOM player recommended"
        );
      }
      setViewport(`${window.innerWidth} × ${window.innerHeight} CSS px`);
      setReducedMotion(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? isTe
            ? "తక్కువ చలన ప్రాధాన్యత (Reduced motion) సక్రియం"
            : "Reduced motion enabled"
          : isTe
            ? "సాధారణ చలన ప్రాధాన్యత"
            : "Standard motion preference"
      );
      setOnline(navigator.onLine);
    }

    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) {
        setHealth({ status: "degraded", database: "error" });
        setCheckState("error");
      } else {
        const data = (await res.json()) as HealthPayload;
        setHealth(data);
        setCheckState("updated");
      }
    } catch {
      setHealth({ status: "unreachable", database: "offline" });
      setCheckState("error");
    }

    setLastCheckedAt(
      new Date().toLocaleTimeString(locale, {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  }, [isTe, locale]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshChecks();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshChecks]);

  return (
    <section aria-labelledby="device-check-heading" className="g1-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="device-check-heading" className="text-xl font-extrabold text-[#0c2444]">
            {isTe
              ? "ప్రత్యక్ష బ్రౌజర్ & ప్లాట్‌ఫారమ్ సంసిద్ధత తనిఖీ"
              : "Live browser & platform readiness check"}
          </h2>
          <p className="mt-1 text-sm text-[#4b637a]">
            {isTe
              ? "ఈ బ్రౌజర్ సెషన్ మరియు స్థానిక PostgreSQL సర్వర్ నుండి నేరుగా కొలవబడింది."
              : "Measured directly on this browser session and local PostgreSQL backend."}
          </p>
        </div>
        <button
          type="button"
          disabled={checkState === "checking"}
          onClick={() => void refreshChecks()}
          data-testid="help-rerun-check"
          className="g1-btn g1-btn-outline min-h-[40px] px-4 text-xs"
        >
          {checkState === "checking" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>
            {checkState === "checking"
              ? isTe
                ? "తనిఖీ చేస్తోంది..."
                : "Checking..."
              : isTe
                ? "మళ్ళీ తనిఖీ చేయండి"
                : "Re-run check"}
          </span>
        </button>
      </div>

      {/* W13: Live accessible status announcement with IST timestamp */}
      <div
        role="status"
        aria-live="polite"
        data-testid="help-check-status"
        className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold ${
          checkState === "error"
            ? "border-[#f3c4be] bg-[#fff1ee] text-[#9b2119]"
            : "border-[#d8eaf2] bg-[#f4fafe] text-[#38546c]"
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          {checkState === "error" ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#046c49]" aria-hidden="true" />
          )}
          <span>
            {checkState === "checking"
              ? isTe
                ? "సర్వర్ మరియు బ్రౌజర్ సామర్థ్యాలను తనిఖీ చేస్తోంది..."
                : "Checking platform API, database connectivity, and browser capabilities..."
              : checkState === "error"
                ? isTe
                  ? "ప్లాట్‌ఫారమ్ సర్వర్ అందుబాటులో లేదు. మీ నెట్‌వర్క్ కనెక్షన్‌ను తనిఖీ చేసి మళ్ళీ ప్రయత్నించండి."
                  : "Platform API check failed or unreachable. Verify connectivity and click Re-run check."
                : isTe
                  ? "తనిఖీ విజయవంతంగా అప్‌డేట్ చేయబడింది."
                  : "Readiness diagnostics updated."}
          </span>
        </span>
        {lastCheckedAt && (
          <span className="font-mono text-[11px] font-bold">
            {isTe ? `చివరి తనిఖీ: ${lastCheckedAt} IST` : `Last checked: ${lastCheckedAt} IST`}
          </span>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#ddebf3] bg-[#f8fcff] p-4">
          <dt className="flex items-center gap-2 text-xs font-bold text-[#4b637a]">
            <Cpu className="h-4 w-4 text-[#007875]" aria-hidden="true" />
            {isTe ? "గ్రాఫిక్స్ సామర్థ్యం" : "Graphics capability"}
          </dt>
          <dd className="mt-1.5 text-sm font-bold text-[#0c2444]">{webgl2}</dd>
        </div>
        <div className="rounded-2xl border border-[#ddebf3] bg-[#f8fcff] p-4">
          <dt className="flex items-center gap-2 text-xs font-bold text-[#4b637a]">
            <Monitor className="h-4 w-4 text-[#007875]" aria-hidden="true" />
            {isTe ? "వ్యూపోర్ట్ & చలన ప్రాధాన్యత" : "Viewport & motion"}
          </dt>
          <dd className="mt-1.5 text-sm font-bold text-[#0c2444]">
            {viewport}
            <div className="mt-0.5 text-xs font-normal text-[#4b637a]">{reducedMotion}</div>
          </dd>
        </div>
        <div className="rounded-2xl border border-[#ddebf3] bg-[#f8fcff] p-4">
          <dt className="flex items-center gap-2 text-xs font-bold text-[#4b637a]">
            <Wifi className="h-4 w-4 text-[#007875]" aria-hidden="true" />
            {isTe ? "నెట్‌వర్క్ కనెక్టివిటీ" : "Connectivity"}
          </dt>
          <dd className="mt-1.5 text-sm font-bold text-[#0c2444]">
            {online
              ? isTe
                ? "ఆన్‌లైన్ (సర్వర్-నిర్ధారించిన సింక్)"
                : "Online (server-confirmed sync)"
              : isTe
                ? "ఆఫ్‌లైన్ (చివరి నిర్ధారించిన రివిజన్ భద్రం)"
                : "Offline (last confirmed checkpoint preserved; reconnect required)"}
          </dd>
        </div>
        <div className="rounded-2xl border border-[#ddebf3] bg-[#f8fcff] p-4">
          <dt className="flex items-center gap-2 text-xs font-bold text-[#4b637a]">
            <CheckCircle2 className="h-4 w-4 text-[#046c49]" aria-hidden="true" />
            {isTe ? "ప్లాట్‌ఫారమ్ API & PostgreSQL" : "Platform API & PostgreSQL"}
          </dt>
          <dd className="mt-1.5 text-sm font-bold text-[#0c2444]">
            {health
              ? `${health.status.toUpperCase()} · DB ${health.database}`
              : isTe
                ? "తనిఖీ చేస్తోంది..."
                : "Checking..."}
            {health?.engineAbi ? (
              <div className="mt-0.5 font-mono text-xs font-normal text-[#4b637a]">
                ABI {health.engineAbi} ·{" "}
                {isTe
                  ? `ట్యూటర్ ${health.optionalTutorEnabled ? "ఆన్" : "ఆఫ్"}`
                  : `Tutor ${health.optionalTutorEnabled ? "on" : "off"}`}
              </div>
            ) : null}
          </dd>
        </div>
      </dl>
    </section>
  );
}
