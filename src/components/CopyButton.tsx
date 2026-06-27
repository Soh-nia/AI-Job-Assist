import { useState } from "react"
import { Copy, Check, } from "lucide-react"


export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors px-2 py-1 rounded hover:bg-slate-100"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

      {/* <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
              <Briefcase size={14} className="text-white" />
            </div>
            <span className="font-display font-bold text-slate-900 text-lg">ApplyAI</span>
          </div>
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors hidden sm:block"
          >
            Powered by Claude
          </a>
        </div>
      </header> */}