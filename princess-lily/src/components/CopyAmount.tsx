"use client";
import { useState } from "react";

export default function CopyAmount({ value, label, done }: { value: string; label: string; done: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
      try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 2500); } catch { /* буфер недоступний — сума видна на екрані */ }
    }}>
      <span aria-live="polite">{ok ? `✓ ${done}` : label}</span>
    </button>
  );
}
