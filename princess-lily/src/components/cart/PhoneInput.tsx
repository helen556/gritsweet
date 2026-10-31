"use client";
import { useState } from "react";
import { maskUaPhone } from "@/lib/ua-phone";

/** Телефон з маскою «+380 XX XXX XX XX»; на сервер іде як введено, сервер нормалізує до +380XXXXXXXXX. */
export default function PhoneInput({ id, name, autoComplete = "tel", invalid }: { id: string; name: string; autoComplete?: string; invalid?: Record<string, unknown> }) {
  const [v, setV] = useState("");
  return (
    <input id={id} name={name} type="tel" inputMode="tel" autoComplete={autoComplete} required placeholder="+380 XX XXX XX XX" className="input" value={v}
      onFocus={() => { if (!v) setV("+380 "); }}
      onBlur={() => { if (v.replace(/\D/g, "") === "380") setV(""); }}
      onChange={(e) => setV(maskUaPhone(e.target.value))} {...invalid} />
  );
}
