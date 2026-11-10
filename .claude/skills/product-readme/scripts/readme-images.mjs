#!/usr/bin/env node
// Renders the two README pictures (coverage matrix, how-it-works flow) from one JSON spec.
// Usage: node readme-images.mjs <spec.json> <output-dir>
// Writes <name>-light.svg and <name>-dark.svg for each picture and prints the matrix as Markdown.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [specPath, outDir] = process.argv.slice(2);
if (!specPath || !outDir) {
  console.error("Usage: node readme-images.mjs <spec.json> <output-dir>");
  process.exit(2);
}
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const fail = message => { console.error(`readme-images: ${message}`); process.exit(1); };

// One sequential hue, light to dark; the dark theme reverses it so "more" is still the stronger cell.
const ramp = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281"];
const themes = {
  light: { bg: "#fcfcfb", ink: "#0b0b0b", ink2: "#52514e", line: "#e3e2de", zero: "#f0efec", card: "#f4f3f0", ramp, accent: "#256abf", accentInk: "#ffffff" },
  dark: { bg: "#1a1a19", ink: "#f0efec", ink2: "#c3c2b7", line: "#3a3a37", zero: "#262625", card: "#242423", ramp: ["#0d366b", ...ramp.slice(1).reverse()], accent: "#3987e5", accentInk: "#0b0b0b" },
};
const font = `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"`;
const esc = text => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const inkOn = hex => luminance(hex) > 0.3 ? "#0b0b0b" : "#ffffff";
const percent = (n, total) => total === 0 ? 0 : Math.round((n / total) * 100);
const svg = (width, height, label, theme, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ${font} role="img" aria-label="${esc(label)}"><rect width="${width}" height="${height}" rx="10" fill="${theme.bg}"/>${body}</svg>\n`;

function checkMatrix(m) {
  const n = m.columns.length;
  if (n < 1 || n > 4) fail("matrix needs 1 to 4 columns");
  for (const row of [...m.rows, m.total]) {
    if (row.values.length !== n) fail(`row "${row.name}" must have ${n} values`);
    if (row.values.some(v => !Number.isInteger(v) || v < 0 || v > row.total)) fail(`row "${row.name}" has a value outside 0..${row.total}`);
    if (row.name.length > 36) fail(`row name "${row.name}" is longer than 36 characters and will collide with the count`);
  }
  if (m.rows.reduce((s, r) => s + r.total, 0) !== m.total.total) fail("row totals do not add up to the total row");
  for (let i = 0; i < n; i++)
    if (m.rows.reduce((s, r) => s + r.values[i], 0) !== m.total.values[i]) fail(`column "${m.columns[i].title}" does not add up to the total row`);
}

function matrix(m, t) {
  const W = 880, L = 290, G = 2, RH = 34, top = 64, n = m.columns.length;
  const CW = Math.floor((W - L - 16 - (n - 1) * G) / n);
  const fill = p => p === 0 ? t.zero : t.ramp[Math.round((p / 100) * (t.ramp.length - 1))];
  let y = top, out = "";
  m.columns.forEach((column, i) => {
    const x = L + i * (CW + G) + CW / 2;
    out += `<text x="${x}" y="28" text-anchor="middle" font-size="14" font-weight="600" fill="${t.ink}">${esc(column.title)}</text>`;
    if (column.subtitle) out += `<text x="${x}" y="46" text-anchor="middle" font-size="12" fill="${t.ink2}">${esc(column.subtitle)}</text>`;
  });
  out += `<text x="16" y="28" font-size="12" fill="${t.ink2}">${esc(m.rowHeader ?? "API area")}</text><text x="${L - 14}" y="28" text-anchor="end" font-size="12" fill="${t.ink2}">${esc(m.countHeader ?? "operations")}</text>`;
  const row = (r, bold) => {
    out += `<text x="16" y="${y + 22}" font-size="13.5" ${bold ? 'font-weight="600"' : ""} fill="${t.ink}">${esc(r.name)}</text><text x="${L - 14}" y="${y + 22}" text-anchor="end" font-size="13" fill="${t.ink2}">${r.total}</text>`;
    r.values.forEach((value, i) => {
      const p = percent(value, r.total), f = fill(p), x = L + i * (CW + G), ink = p === 0 ? t.ink2 : inkOn(f);
      out += `<rect x="${x}" y="${y}" width="${CW}" height="${RH}" rx="4" fill="${f}"/><text x="${x + CW / 2 - 6}" y="${y + 22}" text-anchor="end" font-size="14" font-weight="600" fill="${ink}">${p}%</text><text x="${x + CW / 2 + 2}" y="${y + 22}" font-size="12" fill="${ink}" opacity="0.85">${value}/${r.total}</text>`;
    });
    y += RH + G;
  };
  m.rows.forEach(r => row(r, false));
  y += 8;
  out += `<line x1="16" x2="${W - 16}" y1="${y - 5}" y2="${y - 5}" stroke="${t.line}"/>`;
  row(m.total, true);
  y += 14;
  const sw = 22;
  out += `<text x="${L - 10}" y="${y + 11}" text-anchor="end" font-size="12" fill="${t.ink2}">${esc(m.legend)}: 0%</text><rect x="${L}" y="${y}" width="${sw}" height="14" rx="3" fill="${t.zero}"/>`;
  t.ramp.forEach((color, i) => { out += `<rect x="${L + (i + 1) * (sw + 1)}" y="${y}" width="${sw}" height="14" rx="3" fill="${color}"/>`; });
  out += `<text x="${L + (t.ramp.length + 1) * (sw + 1) + 6}" y="${y + 11}" font-size="12" fill="${t.ink2}">100%</text>`;
  return svg(W, y + 30, m.ariaLabel, t, out);
}

function flow(f, t) {
  if (f.callers.length < 1 || f.callers.length > 4) fail("flow needs 1 to 4 callers");
  if (f.layers.length < 1 || f.layers.length > 5) fail("flow needs 1 to 5 layers");
  const W = 880, boxH = 64, layerH = 46, layerGap = 8, cx = 276, cw = 330;
  const coreH = 64 + f.layers.length * (layerH + layerGap) + 10;
  const callersH = f.callers.length * boxH + (f.callers.length - 1) * 29;
  const H = Math.max(coreH, callersH) + 40, mid = H / 2;
  let out = "";
  const box = (x, y, w, h, item, accent) => {
    const fillColor = accent ? t.accent : t.card, stroke = accent ? t.accent : t.line;
    const ink = accent ? t.accentInk : t.ink, ink2 = accent ? t.accentInk : t.ink2;
    out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fillColor}" stroke="${stroke}"/><text x="${x + w / 2}" y="${y + (item.sub ? h / 2 - 3 : h / 2 + 5)}" text-anchor="middle" font-size="14" font-weight="600" fill="${ink}">${esc(item.title)}</text>`;
    if (item.sub) out += `<text x="${x + w / 2}" y="${y + h / 2 + 15}" text-anchor="middle" font-size="12" fill="${ink2}"${accent ? ' opacity="0.9"' : ""}>${esc(item.sub)}</text>`;
  };
  const arrow = (x1, y1, x2, y2) => {
    out += `<path d="M${x1} ${y1} C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2 - 7} ${y2}" fill="none" stroke="${t.ink2}" stroke-width="1.5"/><path d="M${x2} ${y2} l-8 -4.5 v9 z" fill="${t.ink2}"/>`;
  };
  const callerTop = mid - callersH / 2;
  f.callers.forEach((caller, i) => {
    const y = callerTop + i * (boxH + 29);
    box(16, y, 190, boxH, caller, false);
    arrow(206, y + boxH / 2, cx, mid);
  });
  const coreTop = mid - coreH / 2;
  out += `<rect x="${cx}" y="${coreTop}" width="${cw}" height="${coreH}" rx="10" fill="none" stroke="${t.accent}" stroke-width="1.5"/><text x="${cx + cw / 2}" y="${coreTop + 28}" text-anchor="middle" font-size="15" font-weight="700" fill="${t.ink}">${esc(f.product.title)}</text>`;
  if (f.product.sub) out += `<text x="${cx + cw / 2}" y="${coreTop + 47}" text-anchor="middle" font-size="12" fill="${t.ink2}">${esc(f.product.sub)}</text>`;
  f.layers.forEach((layer, i) => box(cx + 18, coreTop + 64 + i * (layerH + layerGap), cw - 36, layerH, layer, layer.accent === true));
  box(676, mid - 55, 188, 110, f.service, false);
  arrow(cx + cw, mid, 676, mid);
  for (const item of [...f.callers, ...f.layers, f.service]) {
    if (item.title.length > 24) fail(`flow title "${item.title}" is longer than 24 characters`);
    if ((item.sub ?? "").length > 42) fail(`flow subtitle "${item.sub}" is longer than 42 characters`);
  }
  for (const caller of [...f.callers, f.service]) if ((caller.sub ?? "").length > 28) fail(`flow subtitle "${caller.sub}" is longer than 28 characters for a side box`);
  return svg(W, H, f.ariaLabel, t, out);
}

mkdirSync(outDir, { recursive: true });
if (spec.matrix) checkMatrix(spec.matrix);
for (const [name, theme] of Object.entries(themes)) {
  if (spec.matrix) writeFileSync(join(outDir, `coverage-matrix-${name}.svg`), matrix(spec.matrix, theme));
  if (spec.flow) writeFileSync(join(outDir, `how-it-works-${name}.svg`), flow(spec.flow, theme));
}
if (spec.matrix) {
  const m = spec.matrix, line = r => `| ${r.name} | ${r.total} | ${r.values.map(v => `${percent(v, r.total)}% (${v})`).join(" | ")} |`;
  console.log(`| ${m.rowHeader ?? "API area"} | ${m.countHeader ?? "operations"} | ${m.columns.map(c => c.title).join(" | ")} |`);
  console.log(`|---|---:|${m.columns.map(() => "---:").join("|")}|`);
  console.log([...m.rows, m.total].map(line).join("\n"));
}
