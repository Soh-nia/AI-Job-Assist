// ── CV Uploader ─────────────────────────────────────────────────────────────
//
// Handles: file selection via button or drag-and-drop, calls parseCV(),
// shows parsing state, shows extracted word count, allows removal.
//
// The parsed text is passed up to App via onParsed() and used when
// building the message to Claude. The UI distinguishes between:
//   - No file selected (default state)
//   - Parsing in progress (spinner)
//   - Parse error (red banner with message)
//   - Successfully parsed (green badge with filename and word count)

import { useState, useRef } from "react"
import {
  AlertCircle,
  Upload,
  X,
  FileCheck,
} from "lucide-react"
import { parseCV, ACCEPTED_CV_TYPES, type ParseResult } from "../lib/fileParser"

export default function CVUploader({
  parsed,
  parsing,
  onParsed,
  onClear,
  disabled,
}: {
  parsed: ParseResult | null
  parsing: boolean
  onParsed: (result: ParseResult) => void
  onClear: () => void
  disabled: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file: File) => {
    const result = await parseCV(file)
    onParsed(result)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so the same file can be re-selected
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // Successfully parsed state
  if (parsed && !parsed.error) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
        <FileCheck size={18} className="text-green-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-green-800 truncate">{parsed.fileName}</p>
          <p className="text-xs text-green-600">
            {parsed.wordCount.toLocaleString()} words extracted · ready to use
          </p>
        </div>
        {!disabled && (
          <button
            onClick={onClear}
            className="p-1 rounded hover:bg-green-100 text-green-500 hover:text-green-700 transition-colors flex-shrink-0"
            aria-label="Remove CV"
          >
            <X size={15} />
          </button>
        )}
      </div>
    )
  }

  // Error state
  if (parsed?.error) {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{parsed.error}</p>
          </div>
          <button onClick={onClear} className="p-0.5 text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="text-xs text-brand-blue hover:text-brand-navyLight font-medium"
        >
          Try a different file
        </button>
        <input ref={inputRef} type="file" accept={ACCEPTED_CV_TYPES} onChange={handleChange} className="hidden" />
      </div>
    )
  }

  // Parsing state
  if (parsing) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <p className="text-sm text-slate-500">Reading your CV…</p>
      </div>
    )
  }

  // Default: upload prompt
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-xl px-4 py-5 text-center transition-all ${
        dragOver
          ? "border-brand-400 bg-brand-50"
          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_CV_TYPES}
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />
      <Upload size={20} className="mx-auto mb-2 text-slate-300" />
      <p className="text-sm text-slate-500 mb-1">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="text-brand-blue hover:text-brand-navyLight font-medium underline underline-offset-2"
        >
          Upload your CV
        </button>
        {" "}or drag and drop
      </p>
      <p className="text-xs text-slate-400">PDF, DOCX, or TXT · max 10MB</p>
    </div>
  )
}