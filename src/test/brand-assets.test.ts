import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const publicDir = path.join(root, "public");
const read = (file: string) => fs.readFileSync(path.join(publicDir, file));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Lê largura/altura do cabeçalho IHDR de um PNG (e valida a assinatura). */
function pngSize(buffer: Buffer) {
  expect(buffer.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  expect(buffer.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const PNGS: [string, number, number][] = [
  ["favicon-16x16.png", 16, 16],
  ["favicon-32x32.png", 32, 32],
  ["apple-touch-icon.png", 180, 180],
  ["android-chrome-192x192.png", 192, 192],
  ["android-chrome-512x512.png", 512, 512],
  ["android-chrome-maskable-512x512.png", 512, 512],
  ["og-image.png", 1200, 630],
];

describe("ícones e imagem Open Graph em public/", () => {
  it.each(PNGS)("%s é um PNG válido de %ix%i", (file, width, height) => {
    expect(fs.existsSync(path.join(publicDir, file))).toBe(true);
    const buffer = read(file);
    expect(buffer.length).toBeGreaterThan(200);
    expect(pngSize(buffer)).toEqual({ width, height });
  });

  it("og-image.png tem 1200x630 e peso razoável para compartilhamento (< 1 MB)", () => {
    const buffer = read("og-image.png");
    expect(pngSize(buffer)).toEqual({ width: 1200, height: 630 });
    expect(buffer.length).toBeGreaterThan(10_000);
    expect(buffer.length).toBeLessThan(1_000_000);
  });

  it("favicon.svg é um SVG escalável com o gradiente da marca", () => {
    const svg = read("favicon.svg").toString("utf8");
    expect(svg.trimStart().startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="0 0 512 512"');
    expect(svg).toContain("#4F46E5");
    expect(svg).toContain("#7C3AED");
    expect(svg.match(/<svg[^>]*>/)![0]).not.toMatch(/\s(width|height)=/); // escalável: sem tamanho fixo
  });

  it("favicon.ico: cabeçalho ICO válido com imagens 16x16 e 32x32 (PNG embutido)", () => {
    const ico = read("favicon.ico");
    expect(ico.readUInt16LE(0)).toBe(0); // reservado
    expect(ico.readUInt16LE(2)).toBe(1); // tipo = ícone
    const count = ico.readUInt16LE(4);
    expect(count).toBe(2);

    const sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const entry = 6 + i * 16;
      const width = ico.readUInt8(entry) || 256;
      const height = ico.readUInt8(entry + 1) || 256;
      const bytes = ico.readUInt32LE(entry + 8);
      const offset = ico.readUInt32LE(entry + 12);
      expect(width).toBe(height);
      expect(bytes).toBeGreaterThan(0);
      expect(offset + bytes).toBeLessThanOrEqual(ico.length);
      const payload = ico.subarray(offset, offset + bytes);
      expect(pngSize(payload)).toEqual({ width, height });
      sizes.push(width);
    }
    expect(sizes.sort((a, b) => a - b)).toEqual([16, 32]);
  });
});

describe("site.webmanifest", () => {
  const manifest = JSON.parse(read("site.webmanifest").toString("utf8"));

  it("é um JSON válido com a identidade do EasyTicket em pt-BR", () => {
    expect(manifest).toMatchObject({
      name: "EasyTicket",
      short_name: "EasyTicket",
      lang: "pt-BR",
      theme_color: "#4F46E5",
      background_color: "#09090B",
      display: "standalone",
      start_url: "/",
    });
  });

  it("referencia os ícones 192x192 e 512x512, que existem e têm o tamanho declarado", () => {
    const sizes = (manifest.icons as { sizes: string }[]).map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    for (const icon of manifest.icons as { src: string; sizes: string; type: string; purpose?: string }[]) {
      expect(icon.type).toBe("image/png");
      const file = icon.src.replace(/^\//, "");
      const [w, h] = icon.sizes.split("x").map(Number);
      expect(pngSize(read(file))).toEqual({ width: w, height: h });
    }
    expect((manifest.icons as { purpose?: string }[]).some((i) => i.purpose === "maskable")).toBe(true);
  });
});

describe("index.html", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

  it("idioma pt-BR, tema e ícones completos", () => {
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain('<meta name="theme-color" content="#4F46E5" />');
    expect(html).toContain('<link rel="manifest" href="/site.webmanifest" />');
    expect(html).toMatch(/<link rel="icon" href="\/favicon\.ico"/);
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/);
    expect(html).toMatch(/<link rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32x32\.png"/);
    expect(html).toMatch(/<link rel="icon" type="image\/png" sizes="16x16" href="\/favicon-16x16\.png"/);
    expect(html).toMatch(/<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/);
  });

  it("Open Graph e Twitter Card padrão apontam para o og-image absoluto de produção", () => {
    const image = "https://www.easyticket.dev.br/og-image.png";
    for (const tag of ["og:type", "og:site_name", "og:locale", "og:title", "og:description", "og:image", "og:image:width", "og:image:height"]) {
      expect(html).toContain(`property="${tag}"`);
    }
    expect(html).toContain(`<meta property="og:image" content="${image}" />`);
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(html).toContain('<meta property="og:locale" content="pt_BR" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain(`<meta name="twitter:image" content="${image}" />`);
  });

  it("todo arquivo local referenciado no <head> existe em public/", () => {
    const hrefs = [...html.matchAll(/(?:href|content)="(\/[^"]+\.(?:png|ico|svg|webmanifest))"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(6);
    for (const href of hrefs) expect(fs.existsSync(path.join(publicDir, href.slice(1)))).toBe(true);
  });

  it("não sobrou referência aos arquivos antigos removidos", () => {
    expect(html).not.toMatch(/og-image\.jpg|manifest\.json|favicon\.png|icon-192|icon-512/);
  });
});
