"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { apiFetch } from "@/lib/client-api";
import type { Locale } from "@/lib/types";

export function CreatorProvisionForm({ locale }: { locale: Locale }) {
  const te = locale === "te-IN";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    const result = await apiFetch<{ detail?: string }>("/api/admin/creators", {
      method: "POST", body: Object.fromEntries(values.entries()),
    });
    setBusy(false);
    setMessage(result.ok ? (te ? "రచయిత ఖాతా సిద్ధంగా ఉంది. ఇప్పుడు సైన్ ఇన్ చేయవచ్చు." : "Creator account created. The author can now sign in.")
      : result.data.detail || (te ? "ఖాతా సృష్టించలేకపోయాము." : "Unable to create account."));
    if (result.ok) form.reset();
  }

  return <form className="g1-card g1-info-card g1-author-stack" onSubmit={handleSubmit}>
    <label>{te ? "రచయిత ఖాతా పేరు" : "Creator username"}<input required name="username" minLength={3} maxLength={48} autoComplete="off" /></label>
    <label>{te ? "కనిపించే పేరు" : "Display name"}<input required name="displayName" maxLength={100} /></label>
    <label>{te ? "ప్రారంభ పాస్‌వర్డ్" : "Initial password"}<input required name="password" type="password" minLength={14} maxLength={128} autoComplete="new-password" /></label>
    <button type="submit" className="g1-btn g1-btn-teal" disabled={busy}>{te ? "రచయిత ఖాతాను సృష్టించండి" : "Create creator account"}</button>
    <p aria-live="polite">{message}</p>
  </form>;
}
