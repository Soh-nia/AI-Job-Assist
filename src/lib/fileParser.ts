/**
 * lib/fileParser.ts
 *
 * CV file extraction — converts uploaded files to plain text
 * before sending to Claude.
 *
 * WHAT THIS FILE DOES
 * ────────────────────
 * Takes a File object from the browser's file picker and returns
 * the plain text content of that file. Claude then reads this text
 * the same way it reads a textarea — it doesn't care how the text
 * arrived, only what it says.
 *
 * THREE FORMATS SUPPORTED
 * ────────────────────────
 *
 * 1. TXT — FileReader.readAsText() — built into the browser, no library
 *
 * 2. PDF — pdfjs-dist loaded from CDN via dynamic import
 *    PDFs are binary files. pdfjs renders each page and extracts the
 *    text layer. Works for text-based PDFs (which almost all modern CVs
 *    are). Does NOT work for scanned image PDFs — those need OCR.
 *    Both Oremei's and Sonia's CVs are text-based so this handles them.
 *
 * 3. DOCX — mammoth.js loaded from CDN via dynamic import
 *    Word documents are ZIP files containing XML. Mammoth parses the
 *    XML and extracts plain text, stripping all formatting.
 *
 * WHY CDN INSTEAD OF NPM INSTALL?
 * ─────────────────────────────────
 * pdfjs-dist and mammoth together add ~3MB to the bundle. Since CV
 * parsing only happens when the user clicks "Upload CV" we load them
 * lazily via dynamic import — they're only downloaded when needed.
 * This keeps the initial page load fast.
 *
 * WHAT THE EXTRACTED TEXT LOOKS LIKE
 * ────────────────────────────────────
 * After extraction, Sonia's CV text looks like:
 *
 *   "SONIA TENAJERAH
 *    Frontend-Focused Full Stack Developer...
 *    WORK EXPERIENCE
 *    Full Stack Developer | SSDA (Abuja, Nigeria) September 2023 – Present
 *    Key achievements
 *    Conducted API testing with Postman..."
 *
 * Claude reads this and understands the structure — role, company,
 * date, and bullets — because it has seen thousands of CV formats
 * in its training data. You don't need to parse the structure yourself.
 */

export type SupportedFileType = "pdf" | "docx" | "txt"

export interface ParseResult {
  text: string
  fileName: string
  fileType: SupportedFileType
  wordCount: number
  error?: string
}

// ─── File type detection ───────────────────────────────────────────────────

export function getSupportedFileType(file: File): SupportedFileType | null {
  const name = file.name.toLowerCase()
  if (name.endsWith(".pdf")) return "pdf"
  if (name.endsWith(".docx")) return "docx"
  if (name.endsWith(".txt")) return "txt"
  return null
}

export const ACCEPTED_CV_TYPES = ".pdf,.docx,.txt"
export const MAX_FILE_SIZE_MB = 10

// ─── TXT extraction ────────────────────────────────────────────────────────

function extractTxt(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error("Failed to read text file"))
    reader.readAsText(file)
  })
}

// ─── PDF extraction ────────────────────────────────────────────────────────
//
// pdfjs-dist works by rendering each page and reading the text layer.
// We load it from CDN so it's not bundled into the initial JS payload.
//
// For Oremei's CV (4 pages) and Sonia's CV (2 pages), this produces
// clean text in reading order. The page separator (\n\n--- Page N ---\n)
// helps Claude understand where sections might continue across pages.

async function extractPdf(file: File): Promise<string> {
  // Convert File to ArrayBuffer for pdfjs
  const arrayBuffer = await file.arrayBuffer()

  // Dynamic import from CDN — only loaded when needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsLib = await import(
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs"
  ) as any

  // Required: tell pdfjs where to find its worker script
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs"

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pageTexts: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    // textContent.items is an array of text chunks with position data.
    // We join them with spaces, then clean up excess whitespace.
    const pageText = textContent.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()

    if (pageText) {
      pageTexts.push(
        pageNum > 1 ? `\n\n--- Page ${pageNum} ---\n${pageText}` : pageText
      )
    }
  }

  return pageTexts.join("\n")
}

// ─── DOCX extraction ───────────────────────────────────────────────────────
//
// Mammoth converts Word XML to plain text. It strips all formatting
// (bold, tables, colours) which is exactly what we want — Claude
// needs content, not styling.

async function extractDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mammoth = await import(
    "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.esm.js"
  ) as any

  const result = await mammoth.extractRawText({ arrayBuffer })

  if (result.messages?.length) {
    console.warn("[fileParser] Mammoth warnings:", result.messages)
  }

  return result.value as string
}

// ─── Main export ───────────────────────────────────────────────────────────

/**
 * parseCV(file) → ParseResult
 *
 * The single function App.tsx calls. Detects file type, runs the
 * correct extractor, and returns structured result including word count
 * (shown in the UI so users know how much content was extracted).
 */
export async function parseCV(file: File): Promise<ParseResult> {
  // Size check
  const sizeMB = file.size / (1024 * 1024)
  if (sizeMB > MAX_FILE_SIZE_MB) {
    return {
      text: "",
      fileName: file.name,
      fileType: "txt",
      wordCount: 0,
      error: `File too large (${sizeMB.toFixed(1)}MB). Maximum is ${MAX_FILE_SIZE_MB}MB.`,
    }
  }

  const fileType = getSupportedFileType(file)
  if (!fileType) {
    return {
      text: "",
      fileName: file.name,
      fileType: "txt",
      wordCount: 0,
      error: `Unsupported file type. Please upload a PDF, DOCX, or TXT file.`,
    }
  }

  try {
    let text = ""

    if (fileType === "txt") text = await extractTxt(file)
    else if (fileType === "pdf") text = await extractPdf(file)
    else if (fileType === "docx") text = await extractDocx(file)

    const wordCount = text.trim().split(/\s+/).filter(Boolean).length

    if (wordCount < 20) {
      return {
        text: "",
        fileName: file.name,
        fileType,
        wordCount: 0,
        error:
          "Very little text was extracted from this file. It may be a scanned image PDF. Try copying and pasting the CV text manually.",
      }
    }

    return { text, fileName: file.name, fileType, wordCount }
  } catch (err) {
    return {
      text: "",
      fileName: file.name,
      fileType,
      wordCount: 0,
      error: `Failed to read file: ${(err as Error).message}`,
    }
  }
}
