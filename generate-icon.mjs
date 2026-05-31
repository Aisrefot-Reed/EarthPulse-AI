import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateFavicon() {
  const size = 64;
  // A clean Emerald-colored icon representing EarthPulse (Triangle/Tree style)
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="16" fill="#059669"/>
      <path d="M32 15L15 45H49L32 15Z" fill="white" />
      <rect x="29" y="45" width="6" height="5" fill="white" opacity="0.6" />
    </svg>
  `;

  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

  // Generate PNG (Modern standard)
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
    
  // Generate a standard PNG and rename it to .ico (browsers handle this fine)
  await sharp(Buffer.from(svg))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));

  console.log('Icons generated successfully in /public');
}

generateFavicon().catch(console.error);
