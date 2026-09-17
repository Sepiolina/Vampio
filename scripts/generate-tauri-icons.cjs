const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateTauriIcons() {
  const iconsDir = path.resolve(__dirname, '../src-tauri/icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const svgPath = path.resolve(__dirname, '../public/logo.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  // Generate PNG sizes
  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(iconsDir, '32x32.png'));
  await sharp(svgBuffer).resize(128, 128).png().toFile(path.join(iconsDir, '128x128.png'));
  await sharp(svgBuffer).resize(256, 256).png().toFile(path.join(iconsDir, '128x128@2x.png'));
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(iconsDir, 'icon.png'));

  // Copy or generate icon.ico
  const publicIco = path.resolve(__dirname, '../public/favicon.ico');
  if (fs.existsSync(publicIco)) {
    fs.copyFileSync(publicIco, path.join(iconsDir, 'icon.ico'));
  }

  console.log('Successfully generated Tauri desktop icons in src-tauri/icons/');
}

generateTauriIcons().catch(err => {
  console.error('Error generating Tauri icons:', err);
  process.exit(1);
});
