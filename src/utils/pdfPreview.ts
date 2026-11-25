import type { jsPDF } from 'jspdf';

/** Every generated PDF goes through here: shown in the in-app previewer, with download / print / share from there. */
export const PDF_PREVIEW_EVENT = 'opesfuel:pdf-preview';
export interface PdfPreviewRequest { blob: Blob; filename: string }

let hostCount = 0;
/** The previewer component registers itself; without one (tests, scripts) files simply download. */
export function registerPdfPreviewHost(): () => void {
  hostCount += 1;
  return () => { hostCount = Math.max(0, hostCount - 1); };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function openPdfPreview(blob: Blob, filename: string): void {
  if (hostCount > 0) {
    window.dispatchEvent(new CustomEvent<PdfPreviewRequest>(PDF_PREVIEW_EVENT, { detail: { blob, filename } }));
  } else {
    downloadBlob(blob, filename);
  }
}

/** Drop-in replacement for `doc.save(filename)`. */
export function deliverPdf(doc: jsPDF, filename: string): void {
  openPdfPreview(doc.output('blob'), filename);
}
