import { ChevronRight } from "lucide-react"


export default function StepBadge({
  step,
  label,
  active,
  done,
}: {
  step: number
  label: string
  active: boolean
  done: boolean
}) {
  return (
    <div
      className={`flex items-center gap-2 text-xs font-medium transition-all ${
        active ? "text-brand-blue" : done ? "text-green-600" : "text-slate-400"
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
          active
            ? "bg-brand-blue text-white scale-110"
            : done
            ? "bg-green-500 text-white"
            : "bg-slate-200 text-slate-500"
        }`}
      >
        {done ? "✓" : step}
      </div>
      {label}
      {step < 2 && <ChevronRight size={12} className="text-slate-300" />}
    </div>
  )
}