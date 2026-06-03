const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const mdPath = path.join(root, 'INVESTIGATION.md');
const htmlPath = path.join(root, 'INVESTIGATION.html');
const pdfPath = path.join(root, 'INVESTIGATION.pdf');
const pdfTempPath = path.join(root, 'INVESTIGATION.pdf.tmp');

let marked;
try {
  marked = require('marked');
} catch {
  execSync('npm install marked@12 --no-save --prefix "' + path.join(root, 'scripts') + '"', {
    stdio: 'inherit',
    cwd: path.join(root, 'scripts'),
  });
  marked = require(path.join(root, 'scripts', 'node_modules', 'marked'));
}

const md = fs.readFileSync(mdPath, 'utf8');
const body = marked.parse(md);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Kellishub Investigation Report</title>
  <style>
    @page { margin: 18mm 16mm; }
    body {
      font-family: "Segoe UI", Calibri, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #1a1a1a;
      max-width: 100%;
      margin: 0;
      padding: 0 8px;
    }
    h1 { font-size: 22pt; color: #0f172a; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; margin-top: 0; }
    h2 { font-size: 14pt; color: #312e81; margin-top: 1.4em; page-break-after: avoid; }
    h3 { font-size: 12pt; color: #4338ca; page-break-after: avoid; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; page-break-inside: avoid; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #eef2ff; font-weight: 600; }
    tr:nth-child(even) td { background: #f8fafc; }
    code { font-family: Consolas, monospace; font-size: 9pt; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
    pre { background: #0f172a; color: #e2e8f0; padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 8.5pt; page-break-inside: avoid; }
    pre code { background: none; color: inherit; padding: 0; }
    blockquote { border-left: 4px solid #94a3b8; margin: 12px 0; padding-left: 12px; color: #475569; font-style: italic; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    a { color: #4f46e5; }
    ul, ol { padding-left: 1.4em; }
    li { margin: 4px 0; }
    p { margin: 8px 0; }
  </style>
</head>
<body>
${body}
</body>
</html>`;

fs.writeFileSync(htmlPath, html, 'utf8');

const chrome =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = fs.existsSync(chrome) ? chrome : edge;

const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');

try {
  if (fs.existsSync(pdfTempPath)) fs.unlinkSync(pdfTempPath);
} catch (_) {}

execSync(
  `"${browser}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfTempPath}" "${fileUrl}"`,
  { stdio: 'inherit' }
);

try {
  if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
} catch (_) {
  // Target may be open in a viewer — leave .tmp for manual rename
  console.log('PDF written (file locked):', pdfTempPath);
  console.log('Close INVESTIGATION.pdf and re-run, or rename .tmp to INVESTIGATION.pdf');
  process.exit(0);
}

fs.renameSync(pdfTempPath, pdfPath);
console.log('HTML created:', htmlPath);
console.log('PDF created:', pdfPath);
