import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(root, 'public')

const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img">
  <rect width="512" height="512" rx="112" fill="#0f766e"/>
  <rect x="118" y="96" width="276" height="320" rx="36" fill="#ecfdf5"/>
  <path d="M176 188h160M176 256h160M176 324h104" stroke="#0f766e" stroke-width="28" stroke-linecap="round"/>
  <path d="M352 300l36 36 68-78" fill="none" stroke="#14b8a6" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const maskableSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img">
  <rect width="512" height="512" fill="#0f766e"/>
  <rect x="146" y="136" width="220" height="240" rx="28" fill="#ecfdf5"/>
  <path d="M190 208h132M190 256h132M190 304h84" stroke="#0f766e" stroke-width="22" stroke-linecap="round"/>
  <path d="M318 286l28 28 52-60" fill="none" stroke="#14b8a6" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

async function writePng(svg, fileName, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(publicDir, fileName))
}

writeFileSync(path.join(publicDir, 'favicon.svg'), faviconSvg)

await writePng(faviconSvg, 'pwa-192.png', 192)
await writePng(faviconSvg, 'pwa-512.png', 512)
await writePng(maskableSvg, 'pwa-maskable-512.png', 512)
await writePng(faviconSvg, 'apple-touch-icon.png', 180)

console.log('Generated Planora favicon and PWA icons in public/')
