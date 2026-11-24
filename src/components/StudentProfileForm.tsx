"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-api";
import type { Locale } from "@/lib/types";

export function StudentProfileForm({ locale, displayName }: { locale: Locale; displayName: string }) {
  const router = useRouter();
  const te = locale === "te-IN";
  const [name, setName] = useState(displayName);
  const [savedName, setSavedName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "error" | null>(null);
  const trimmedName = name.trim();

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !trimmedName || trimmedName === savedName) return;
    setSaving(true);
    setFeedback(null);
    const response = await apiFetch("/api/student/profile", {
      method: "PUT",
      body: { displayName: trimmedName },
    });
    setSaving(false);
    if (!response.ok) {
      setFeedback("error");
      return;
    }
    setName(trimmedName);
    setSavedName(trimmedName);
    setFeedback("saved");
    router.refresh();
  }

  return (
    <form className="mt-5" onSubmit={saveProfile}>
      <label htmlFor="student-display-name" className="block text-sm font-bold text-[#0c2444]">
        {te ? "ప్రదర్శన పేరు" : "Display name"}
      </label>
      <input
        id="student-display-name"
        className="mt-2 min-h-11 w-full border px-3 py-2 text-[#0c2444]"
        type="text"
        autoComplete="nickname"
        required
        maxLength={100}
        readOnly={saving}
        value={name}
        onChange={event => { setName(event.target.value); setFeedback(null); }}
        aria-describedby="student-display-name-hint"
      />
      <p id="student-display-name-hint" className="mt-2 text-sm text-[#38546c]">
        {te ? "ఈ పేరు మీ విద్యార్థి డ్యాష్‌బోర్డ్‌లో కనిపిస్తుంది." : "This name appears on your student dashboard."}
      </p>
      <button
        type="submit"
        className="g1-btn g1-btn-teal mt-4 min-h-11 px-5 text-sm"
        disabled={saving || !trimmedName || trimmedName === savedName}
      >
        {saving ? (te ? "సేవ్ అవుతోంది…" : "Saving…") : (te ? "మార్పులు సేవ్ చేయండి" : "Save changes")}
      </button>
      {feedback === "saved" && (
        <p role="status" className="mt-3 text-sm font-semibold text-[#046c49]">
          {te ? "ప్రొఫైల్ సేవ్ అయింది." : "Profile saved."}
        </p>
      )}
      {feedback === "error" && (
        <p role="alert" className="mt-3 text-sm font-semibold text-[#9b2119]">
          {te ? "మార్పులు సేవ్ కాలేదు. మళ్లీ ప్రయత్నించండి." : "Your changes couldn’t be saved. Please try again."}
        </p>
      )}
    </form>
  );
}
