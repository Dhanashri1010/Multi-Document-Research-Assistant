/**
 * PDF Export Utility
 * Generates an isolated, styled academic document window and invokes the browser's native PDF export dialog.
 */
export function exportContentToPdf(options: {
  title: string;
  subtitle?: string;
  contentMarkdown: string;
}): void {
  const { title, subtitle, contentMarkdown } = options;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups for this site to export the PDF document.');
    return;
  }

  // Convert Markdown headings, lists, bold, italics, tables to clean HTML
  const formattedHtml = contentMarkdown
    .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-6 mb-3 text-slate-900 border-b pb-1">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold mt-5 mb-2 text-slate-800">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mt-4 mb-2 text-slate-800">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^[-*] (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-3 text-slate-700 leading-relaxed">')
    .replace(/\n/g, '<br/>');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            line-height: 1.6;
            font-size: 11pt;
            padding: 24px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            font-size: 16pt;
            color: #0f172a;
            margin-top: 18pt;
            margin-bottom: 8pt;
            border-bottom: 1.5pt solid #cbd5e1;
            padding-bottom: 4pt;
          }
          h2 {
            font-size: 13pt;
            color: #1e293b;
            margin-top: 14pt;
            margin-bottom: 6pt;
          }
          h3 {
            font-size: 11pt;
            color: #334155;
            margin-top: 10pt;
            margin-bottom: 4pt;
          }
          p {
            margin-bottom: 8pt;
            text-align: justify;
          }
          li {
            margin-bottom: 4pt;
          }
          .header {
            border-bottom: 2pt solid #2563eb;
            padding-bottom: 12pt;
            margin-bottom: 18pt;
          }
          .doc-title {
            font-size: 18pt;
            font-weight: bold;
            color: #1e3a8a;
            margin: 0 0 4pt 0;
          }
          .meta {
            font-size: 9pt;
            color: #64748b;
            margin: 0;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="doc-title">${title}</div>
          <p class="meta">
            ${subtitle ? `${subtitle} · ` : ''}Multi-Document Research Assistant · Generated on ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <div class="content">
          <p class="mb-3 text-slate-700 leading-relaxed">${formattedHtml}</p>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
