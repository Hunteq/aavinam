/**
 * PWA Icon Generator — Aavinam
 * Generates icon-72.png, icon-96.png, icon-128.png, icon-192.png, icon-512.png
 * from the existing public/MilkLogo.png using the 'sharp' library.
 *
 * Run: node scripts/generate-icons.cjs
 */

const path = require('path');
const fs = require('fs');

const SIZES = [72, 96, 128, 192, 512];
const SOURCE = path.resolve(__dirname, '../public/MilkLogo.png');
const DEST_DIR = path.resolve(__dirname, '../public/icons');

async function generateIcons() {
    let sharp;
    try {
        sharp = require('sharp');
    } catch {
        console.error('❌ "sharp" package not found. Installing...');
        const { execSync } = require('child_process');
        execSync('npm install sharp --save-dev', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
        sharp = require('sharp');
    }

    if (!fs.existsSync(SOURCE)) {
        console.error(`❌ Source image not found: ${SOURCE}`);
        process.exit(1);
    }

    if (!fs.existsSync(DEST_DIR)) {
        fs.mkdirSync(DEST_DIR, { recursive: true });
        console.log(`📁 Created directory: ${DEST_DIR}`);
    }

    console.log(`🖼  Generating icons from: ${SOURCE}`);

    for (const size of SIZES) {
        const outputPath = path.join(DEST_DIR, `icon-${size}.png`);
        await sharp(SOURCE)
            .resize(size, size, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .png()
            .toFile(outputPath);
        console.log(`  ✅ Generated icon-${size}.png`);
    }

    console.log('\n🎉 All PWA icons generated successfully!');
    console.log(`📂 Location: ${DEST_DIR}`);
}

generateIcons().catch((err) => {
    console.error('❌ Icon generation failed:', err.message);
    process.exit(1);
});
