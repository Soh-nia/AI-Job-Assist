/**
 * lib/fileParser.ts
 * CV file extraction for job assistant
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

export type SupportedFileType = "pdf" | "docx" | "txt";

export interface ParseResult {
  text: string;
  fileName: string;
  fileType: SupportedFileType;
  wordCount: number;
  error?: string;
}

// ─── Config ────────────────────────────────────────────────────────────────

export const ACCEPTED_CV_TYPES = ".pdf,.docx,.txt";
export const MAX_FILE_SIZE_MB = 10;

// Set up PDF.js worker (important!) — bundled locally so its version always
// matches the installed pdfjs-dist API version.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ─── File type detection ───────────────────────────────────────────────────

export function getSupportedFileType(file: File): SupportedFileType | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".txt")) return "txt";
  return null;
}

// ─── TXT extraction ────────────────────────────────────────────────────────

function extractTxt(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("Failed to read text file"));
    reader.readAsText(file);
  });
}

// ─── PDF extraction ────────────────────────────────────────────────────────

async function extractPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item: any) => (item as any).str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      pageTexts.push(
        pageNum > 1
          ? `\n\n--- Page ${pageNum} ---\n${pageText}`
          : pageText
      );
    }
  }

  return pageTexts.join("\n");
}

// ─── DOCX extraction ───────────────────────────────────────────────────────

async function extractDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });

  if (result.messages?.length) {
    console.warn("[fileParser] Mammoth warnings:", result.messages);
  }

  return result.value as string;
}

// ─── Main function ─────────────────────────────────────────────────────────

export async function parseCV(file: File): Promise<ParseResult> {
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    return {
      text: "",
      fileName: file.name,
      fileType: "txt",
      wordCount: 0,
      error: `File too large (${sizeMB.toFixed(1)}MB). Maximum is ${MAX_FILE_SIZE_MB}MB.`,
    };
  }

  const fileType = getSupportedFileType(file);
  if (!fileType) {
    return {
      text: "",
      fileName: file.name,
      fileType: "txt",
      wordCount: 0,
      error: "Unsupported file type. Please upload a PDF, DOCX, or TXT file.",
    };
  }

  try {
    let text = "";

    if (fileType === "txt") text = await extractTxt(file);
    else if (fileType === "pdf") text = await extractPdf(file);
    else if (fileType === "docx") text = await extractDocx(file);

    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    if (wordCount < 20) {
      return {
        text: "",
        fileName: file.name,
        fileType,
        wordCount: 0,
        error: "Very little text was extracted. It may be a scanned PDF. Try pasting the text manually.",
      };
    }

    return { text, fileName: file.name, fileType, wordCount };
  } catch (err) {
    return {
      text: "",
      fileName: file.name,
      fileType,
      wordCount: 0,
      error: `Failed to read file: ${(err as Error).message}`,
    };
  }
}