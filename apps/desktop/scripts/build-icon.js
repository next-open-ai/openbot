/**
 * 从项目 logo.svg 生成 electron-builder 用的应用图标（1024x1024 PNG）。
 * macOS / Windows / Linux 会由 electron-builder 自动生成 .icns / .ico 等。
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const srcSvg = path.join(root, 'renderer', 'src', 'assets', 'logo.svg');
const outDir = path.join(root, 'build');
const outPng = path.join(outDir, 'icon.png');

fs.mkdirSync(outDir, { recursive: true });
sharp(srcSvg)
    .resize(1024, 1024)
    .png()
    .toFile(outPng)
    .then(() => console.log('Built icon:', outPng))
    .catch((err) => {
        console.error('build-icon failed:', err);
        process.exit(1);
    });
