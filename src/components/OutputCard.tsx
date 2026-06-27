import React from 'react'
import CopyButton from './CopyButton'

export default function OutputCard({
  title,
  content,
  isStreaming,
  icon,
}: {
  title: string
  content: string
  isStreaming: boolean
  icon: React.ReactNode
}) {
  const formatted = content
    .split("\n")
    .map((line) => {
      if (line.startsWith("## "))
        return `<h2 class="font-bold text-slate-900 text-base mt-5 mb-2 first:mt-0" style={{ fontFamily: "'Transforma Mix', 'Playfair Display', Georgia, serif" }}>${line.slice(3)}</h2>`
      if (line.startsWith("- "))
        return `<div class="flex gap-2 text-sm text-slate-700 leading-relaxed mb-1.5"><span class="text-brand-blue flex-shrink-0 mt-0.5">▸</span><span>${line.slice(2)}</span></div>`
      if (line.trim() === "") return "<div class='h-2'></div>"
      return `<p class="text-sm text-slate-600 leading-relaxed mb-2">${line}</p>`
    })
    .join("")

  return (
    <div
      className={`border rounded-xl bg-white transition-all ${
        isStreaming
          ? "border-brand-200 shadow-lg shadow-brand-50"
          : content
          ? "border-slate-200 shadow-sm"
          : "border-dashed border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-brand-blue">{icon}</span>
          <span className="text-lg font-semibold text-slate-800"
          style={{ fontFamily: "'Transforma Mix', 'Playfair Display', Georgia, serif" }}>{title}</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-brand-blue bg-brand-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-brand-blue rounded-full animate-pulse" />
              Writing…
            </span>
          )}
        </div>
        {content && !isStreaming && <CopyButton text={content} />}
      </div>
      <div className="p-4 min-h-[80px]">
        {content ? (
          <div
            className={isStreaming ? "cursor-blink" : ""}
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
        ) : (
          <p className="text-sm text-slate-400 italic">
            {isStreaming ? "" : "Output will appear here…"}
          </p>
        )}
      </div>
    </div>
  )
}
