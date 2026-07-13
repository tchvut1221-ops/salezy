/**
 * Client-only. Renders a DOM node to a real, directly-downloaded PDF file —
 * jsPDF's save() builds a Blob and clicks a hidden <a download>, no browser
 * print dialog involved. Replaces the previous window.print() flow (still
 * available to a user via the browser's native Ctrl+P, styled by
 * app/analysis/[id]/print.css — this is the app's own "הורד PDF" button).
 *
 * Approach: rasterize the node with html2canvas rather than rebuild every
 * analysis card in a PDF-primitive tree (e.g. @react-pdf/renderer). The
 * analysis view is deeply Tailwind-styled RTL Hebrew content with an inline
 * SVG gauge and Recharts — rasterizing captures exactly what's already
 * correctly laid out and font-shaped on screen, with zero separate RTL/
 * Hebrew-font-embedding risk. The output is a multi-page A4 image PDF (not
 * selectable text), which is the standard, acceptable tradeoff for a
 * "download this report" action on a page like this.
 *
 * jsPDF/html2canvas (~250KB combined) are dynamically imported so they only
 * load when a user actually exports, not on every analysis page view.
 */
export async function exportElementToPdf(elementId: string, fileName: string) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  // Rasterize a light/printable version, matching print.css's intent, without
  // ever touching the live (dark-themed) page — onclone's document/element
  // are an offscreen clone html2canvas builds solely for rendering.
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
      const style = clonedDoc.createElement("style");
      style.textContent = `
        #${elementId}, #${elementId} * {
          color: #111111 !important;
          background: transparent !important;
          border-color: #d4d4d8 !important;
          box-shadow: none !important;
        }
        /* The analysis view collapses each section's expanded content behind
           "פרטים נוספים" (hidden attribute, components/salezy/analysis-section.tsx).
           A downloaded PDF is a full report, not a snapshot of what happens to be
           expanded on screen — force every section open in this offscreen clone only,
           never touching the live page. */
        #${elementId} [data-analysis-details] {
          display: block !important;
        }
      `;
      clonedDoc.head.appendChild(style);
      clonedElement.style.backgroundColor = "#ffffff";
    },
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidthMm = pageWidth;
  const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

  // Standard jsPDF + html2canvas pagination: place the full image at a
  // progressively more negative y offset on each new page, so each page
  // reveals the next pageHeight-tall slice of it (jsPDF clips to the page).
  let heightLeft = imgHeightMm;
  let position = 0;
  pdf.addImage(imgData, "JPEG", 0, position, imgWidthMm, imgHeightMm);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeightMm;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidthMm, imgHeightMm);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
}

/** Derives a safe PDF file name from the original recording's file name. */
export function toPdfFileName(originalFileName: string): string {
  const base = originalFileName.replace(/\.[^/.]+$/, "").trim();
  const safe = base.replace(/[\\/:*?"<>|]/g, "_");
  return `${safe || "ניתוח-שיחה"}.pdf`;
}
