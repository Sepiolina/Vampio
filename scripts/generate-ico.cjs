const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

async function buildImages() {
  const svgPath = path.resolve(__dirname, '../public/logo.svg');
  const pngPath = path.resolve(__dirname, '../public/logo.png');
  const png256Path = path.resolve(__dirname, '../public/logo-256.png');
  const png32Path = path.resolve(__dirname, '../public/logo-32.png');
  const png16Path = path.resolve(__dirname, '../public/logo-16.png');
  const icoPath = path.resolve(__dirname, '../public/favicon.ico');

  const svgBuffer = fs.readFileSync(svgPath);

  // Generate transparent PNGs
  await sharp(svgBuffer).resize(512, 512).png().toFile(pngPath);
  await sharp(svgBuffer).resize(256, 256).png().toFile(png256Path);
  await sharp(svgBuffer).resize(32, 32).png().toFile(png32Path);
  await sharp(svgBuffer).resize(16, 16).png().toFile(png16Path);

  console.log('Successfully generated transparent PNGs: logo.png (512x512), logo-32.png, logo-16.png');

  // Try convert (ImageMagick) to build favicon.ico
  let converted = false;
  try {
    execSync(`convert "${png32Path}" "${png16Path}" "${icoPath}"`, { stdio: 'inherit' });
    console.log('Successfully created favicon.ico using ImageMagick');
    converted = true;
  } catch (err) {
    console.log('ImageMagick convert failed, building native ICO binary structure...');
  }

  if (!converted || !fs.existsSync(icoPath)) {
    // Standard ICO file format wrapping 32x32 and 16x16 PNGs
    const buf32 = fs.readFileSync(png32Path);
    const buf16 = fs.readFileSync(png16Path);

    const numImages = 2;
    const headerSize = 6;
    const dirEntrySize = 16;
    const offset1 = headerSize + dirEntrySize * numImages;
    const offset2 = offset1 + buf32.length;

    const icoHeader = Buffer.alloc(headerSize);
    icoHeader.writeUInt16LE(0, 0); // Reserved
    icoHeader.writeUInt16LE(1, 2); // 1 = ICO
    icoHeader.writeUInt16LE(numImages, 4); // Number of images

    // Entry 1: 32x32
    const entry1 = Buffer.alloc(dirEntrySize);
    entry1.writeUInt8(32, 0); // Width
    entry1.writeUInt8(32, 1); // Height
    entry1.writeUInt8(0, 2);  // Colors
    entry1.writeUInt8(0, 3);  // Reserved
    entry1.writeUInt16LE(1, 4); // Color planes
    entry1.writeUInt16LE(32, 6); // Bits per pixel
    entry1.writeUInt32LE(buf32.length, 8); // Size
    entry1.writeUInt32LE(offset1, 12); // Offset

    // Entry 2: 16x16
    const entry2 = Buffer.alloc(dirEntrySize);
    entry2.writeUInt8(16, 0); // Width
    entry2.writeUInt8(16, 1); // Height
    entry2.writeUInt8(0, 2);  // Colors
    entry2.writeUInt8(0, 3);  // Reserved
    entry2.writeUInt16LE(1, 4); // Color planes
    entry2.writeUInt16LE(32, 6); // Bits per pixel
    entry2.writeUInt32LE(buf16.length, 8); // Size
    entry2.writeUInt32LE(offset2, 12); // Offset

    const fullIco = Buffer.concat([icoHeader, entry1, entry2, buf32, buf16]);
    fs.writeFileSync(icoPath, fullIco);
    console.log('Successfully created native multi-resolution favicon.ico');
  }
}

buildImages().catch((err) => {
  console.error('Error generating ICO/PNG:', err);
  process.exit(1);
});
