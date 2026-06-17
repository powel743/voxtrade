// ─────────────────────────────────────────────────────────────────────────────
// ReasoningPanel — expandable accordion of Gemini's reasoning, closed by default
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { Reasoning } from "../types";

interface Section {
  key: keyof Reasoning;
  label: string;
  danger?: boolean;
}

const SECTIONS: Section[] = [
  { key: "h1_bias", label: "H1 Bias & Structure" },
  { key: "h1_liquidity", label: "H1 Liquidity" },
  { key: "m15_setup", label: "M15 Setup" },
  { key: "m15_structure", label: "M15 Structure Alignment" },
  { key: "m5_entry", label: "M5 Entry Trigger" },
  { key: "sl_rationale", label: "SL Rationale" },
  { key: "tp_rationale", label: "TP Rationale" },
  { key: "invalidation", label: "Invalidation Conditions", danger: true },
];

function AccordionRow({
  section,
  value,
}: {
  section: Section;
  value: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-card-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-bg/40"
      >
        <span
          className={[
            "text-sm font-semibold",
            section.danger ? "text-sell" : "text-text-primary",
          ].join(" ")}
        >
          {section.label}
        </span>
        <span
          className={[
            "text-text-secondary transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        >
          ▾
        </span>
      </button>
      {open && (
        <div
          className={[
            "px-4 pb-4 text-sm leading-relaxed animate-fade-in",
            section.danger ? "text-sell/90" : "text-text-secondary",
          ].join(" ")}
        >
          {value || "—"}
        </div>
      )}
    </div>
  );
}

export function ReasoningPanel({ reasoning }: { reasoning: Reasoning }): JSX.Element {
  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card">
      <div className="border-b border-card-border px-4 py-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-text-secondary">
          Analysis Reasoning
        </h3>
      </div>
      {SECTIONS.map((section) => (
        <AccordionRow key={section.key} section={section} value={reasoning[section.key]} />
      ))}
    </div>
  );
}
