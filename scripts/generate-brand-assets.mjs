#!/usr/bin/env node
/**
 * Gera os ativos de marca em public/: favicons, ícones do PWA e a imagem Open Graph.
 *
 *   npm i --no-save sharp        # só para gerar; não é dependência do projeto
 *   npm run assets:brand
 *
 * Tudo é vetorial (SVG) e rasterizado no tamanho exato de cada arquivo, então os ícones saem nítidos.
 * O favicon.ico é montado aqui mesmo (ICO com PNGs de 16x16 e 32x32 embutidos).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("Este script precisa do 'sharp' apenas para gerar as imagens:\n  npm i --no-save sharp");
  process.exit(1);
}

const INDIGO = "#4F46E5";
const VIOLET = "#7C3AED";
const FONT = "Inter, 'DejaVu Sans', Arial, sans-serif";

/* ------------------------------ ícone (ingresso) ------------------------------ */

/**
 * Ingresso branco inclinado, com entalhes e picote (os "furos" são recortes reais, via máscara).
 * `bold` = versão simplificada para 16–32px (sem picote, formas maiores) para continuar legível.
 */
function ticketGlyph({ bold = false, scale = 1, id = "t" } = {}) {
  const w = bold ? 344 : 300;
  const h = bold ? 224 : 188;
  const x = 256 - w / 2;
  const y = 256 - h / 2;
  const notchX = x + w * 0.7;
  const notchR = bold ? 30 : 24;
  const dots = bold
    ? ""
    : Array.from({ length: 6 }, (_, i) => `<circle cx="${notchX}" cy="${y + 34 + i * 24}" r="5.5" fill="#000"/>`).join("");
  return `
    <defs>
      <mask id="${id}">
        <rect width="512" height="512" fill="#fff"/>
        <circle cx="${notchX}" cy="${y}" r="${notchR}" fill="#000"/>
        <circle cx="${notchX}" cy="${y + h}" r="${notchR}" fill="#000"/>
        ${dots}
      </mask>
    </defs>
    <g transform="translate(256 256) scale(${scale}) rotate(-22) translate(-256 -256)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${bold ? 36 : 30}" fill="#fff" mask="url(#${id})"/>
    </g>`;
}

const gradientDefs = (id = "bg") => `
  <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${INDIGO}"/>
    <stop offset="1" stop-color="${VIOLET}"/>
  </linearGradient>`;

/** variant: "rounded" (cantos transparentes), "bleed" (quadrado cheio: apple-touch) ou "maskable" (zona segura). */
function iconSvg(size, { variant = "rounded", bold = false } = {}) {
  const bg =
    variant === "rounded"
      ? `<rect width="512" height="512" rx="112" fill="url(#bg)"/>`
      : `<rect width="512" height="512" fill="url(#bg)"/>`;
  const scale = variant === "maskable" ? 0.74 : bold ? 1.04 : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>${gradientDefs()}</defs>
  ${bg}
  ${ticketGlyph({ bold, scale })}
</svg>`;
}

/* ------------------------------ imagem Open Graph ------------------------------ */

function ogSvg() {
  const W = 1200;
  const H = 630;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${gradientDefs("brand")}
    <linearGradient id="word" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#A5B4FC"/>
      <stop offset="1" stop-color="#C4B5FD"/>
    </linearGradient>
    <radialGradient id="glowA" cx="0.85" cy="0.1" r="0.7">
      <stop offset="0" stop-color="${VIOLET}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${VIOLET}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0.05" cy="1" r="0.8">
      <stop offset="0" stop-color="${INDIGO}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${INDIGO}" stop-opacity="0"/>
    </radialGradient>
    <mask id="ticketMask">
      <rect width="${W}" height="${H}" fill="#fff"/>
      <circle cx="942" cy="170" r="38" fill="#000"/>
      <circle cx="942" cy="460" r="38" fill="#000"/>
      ${Array.from({ length: 9 }, (_, i) => `<circle cx="942" cy="${208 + i * 30}" r="7" fill="#000"/>`).join("")}
    </mask>
  </defs>

  <rect width="${W}" height="${H}" fill="#09090B"/>
  <rect width="${W}" height="${H}" fill="url(#glowA)"/>
  <rect width="${W}" height="${H}" fill="url(#glowB)"/>

  <!-- ingresso decorativo -->
  <g transform="rotate(-10 920 315)" opacity="0.95">
    <rect x="700" y="170" width="440" height="290" rx="44" fill="url(#brand)" mask="url(#ticketMask)"/>
    <text x="752" y="330" font-family="${FONT}" font-size="46" font-weight="800" fill="#fff" fill-opacity="0.92">ADMIT</text>
    <text x="752" y="378" font-family="${FONT}" font-size="46" font-weight="800" fill="#fff" fill-opacity="0.92">ONE</text>
    <text x="985" y="330" font-family="${FONT}" font-size="26" font-weight="600" fill="#fff" fill-opacity="0.8">QR CODE</text>
    <rect x="985" y="350" width="104" height="104" rx="12" fill="#fff" fill-opacity="0.92"/>
    <g fill="#312E81">
      <rect x="996" y="361" width="30" height="30"/><rect x="1048" y="361" width="30" height="30"/><rect x="996" y="413" width="30" height="30"/>
      <rect x="1035" y="400" width="14" height="14"/><rect x="1056" y="421" width="22" height="22"/><rect x="1035" y="427" width="14" height="14"/>
    </g>
  </g>

  <!-- marca -->
  <g transform="translate(80 150)">
    <rect width="150" height="150" rx="34" fill="url(#brand)"/>
    <g transform="scale(0.2930)">${ticketGlyph({ id: "ogt" })}</g>
  </g>
  <text x="80" y="400" font-family="${FONT}" font-size="100" font-weight="800" fill="#FFFFFF" letter-spacing="-3">EasyTicket</text>
  <text x="84" y="468" font-family="${FONT}" font-size="40" font-weight="500" fill="url(#word)">Ingressos digitais em segundos</text>
  <text x="84" y="560" font-family="${FONT}" font-size="28" font-weight="500" fill="#A1A1AA">easyticket.dev.br</text>
</svg>`;
}

/* ------------------------------ ICO (PNG embutido) ------------------------------ */

function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: ícone
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // largura
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // altura
    entry.writeUInt8(0, 2); // paleta
    entry.writeUInt8(0, 3); // reservado
    entry.writeUInt16LE(1, 4); // planos
    entry.writeUInt16LE(32, 6); // bits por pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

/* ------------------------------ geração ------------------------------ */

const write = (name, data) => {
  fs.writeFileSync(path.join(PUBLIC_DIR, name), data);
  console.log(`✓ ${name} (${data.length} bytes)`);
};
const png = (svg, size = null) => {
  let image = sharp(Buffer.from(svg));
  if (size) image = image.resize(size.width, size.height);
  return image.png({ compressionLevel: 9 }).toBuffer();
};

fs.mkdirSync(PUBLIC_DIR, { recursive: true });

write("favicon.svg", `${iconSvg(512).replace(' width="512" height="512"', "").replace(/[ \t]+$/gm, "")}\n`);

const png16 = await png(iconSvg(16, { bold: true }));
const png32 = await png(iconSvg(32, { bold: true }));
write("favicon-16x16.png", png16);
write("favicon-32x32.png", png32);
write("favicon.ico", buildIco([{ size: 16, png: png16 }, { size: 32, png: png32 }]));

write("apple-touch-icon.png", await png(iconSvg(180, { variant: "bleed" })));
write("android-chrome-192x192.png", await png(iconSvg(192)));
write("android-chrome-512x512.png", await png(iconSvg(512)));
write("android-chrome-maskable-512x512.png", await png(iconSvg(512, { variant: "maskable" })));
write("og-image.png", await png(ogSvg()));

write(
  "site.webmanifest",
  `${JSON.stringify(
    {
      name: "EasyTicket",
      short_name: "EasyTicket",
      description: "Compre e gerencie ingressos para festas, shows e eventos com PIX ou cartão e QR Code digital.",
      lang: "pt-BR",
      dir: "ltr",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait-primary",
      background_color: "#09090B",
      theme_color: INDIGO,
      icons: [
        { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/android-chrome-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    null,
    2,
  )}\n`,
);
