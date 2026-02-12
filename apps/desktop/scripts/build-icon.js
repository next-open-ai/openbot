/**
 * 从项目 logo.svg 生成：
 * 1. build/icon.png（1024x1024）供 electron-builder 做应用图标
 * 2. assets/trayTemplate.png（22x22 黑白透明）供 macOS 菜单栏托盘显示
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const srcSvg = path.join(root, 'renderer', 'src', 'assets', 'logo.svg');
const outDir = path.join(root, 'build');
const assetsDir = path.join(root, 'assets');
const outPng = path.join(outDir, 'icon.png');
const trayTemplatePng = path.join(assetsDir, 'trayTemplate.png');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

// 应用图标 1024x1024
const buildAppIcon = sharp(srcSvg)
    .resize(1024, 1024)
    .png()
    .toFile(outPng)
    .then(() => console.log('Built icon:', outPng));

// macOS 托盘模板图：22x22，仅黑+透明（菜单栏才能正确显示）
const buildTrayTemplate = sharp(srcSvg)
    .resize(22, 22)
    .ensureAlpha()
    .linear(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1)
    .png()
    .toFile(trayTemplatePng)
    .then(() => console.log('Built trayTemplate:', trayTemplatePng));

Promise.all([buildAppIcon, buildTrayTemplate]).catch((err) => {
    console.error('build-icon failed:', err);
    process.exit(1);
});
