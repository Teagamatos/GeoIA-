import { IconTrendDown, IconTrendUp } from "./icons";
import { DonutRing } from "./DonutRing";

interface StatCardProps {
  label: string;
  sublabel: string;
  value: string;
  delta?: number | null;
  accent?: "amber" | "teal";
  /** Fração que originou o %, ex: 12 execuções de 72 mencionam a marca. */
  frac?: { parte: number; total: number; descricao: string };
}

export function StatCard({ label, sublabel, value, delta, accent = "amber", frac }: StatCardProps) {
  const accentColor = accent === "amber" ? "#C9973E" : "#1E9E86";
  const pct = frac && frac.total > 0 ? (frac.parte / frac.total) * 100 : 0;

  return (
    <div className="flex-1 rounded-card border border-surface-200 bg-surface-0 p-6 flex flex-col">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-700">{label}</span>
        {delta !== undefined && delta !== null && <DeltaBadge delta={delta} />}
      </div>

      <div className="mt-1 font-display text-4xl font-semibold text-slate-900">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{sublabel}</div>

      {frac && (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center">
          <DonutRing pct={pct} color={accentColor} size={148} strokeWidth={12} centerLabel={`${frac.parte}/${frac.total}`} />
          <p className="mt-4 text-center text-sm text-slate-500 max-w-[220px]">{frac.descricao}</p>
        </div>
      )}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.05) {
    return <span className="text-xs text-slate-500">—</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={`flex items-center gap-0.5 text-xs font-medium ${
        up ? "text-signal-teal" : "text-signal-rose"
      }`}
    >
      {up ? <IconTrendUp className="h-3 w-3" /> : <IconTrendDown className="h-3 w-3" />}
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}
