const sharp = require('sharp');
const fs = require('fs');

async function main() {
    try {
        const svgBuffer = fs.readFileSync('public/cribro-logo.svg');
        await sharp(svgBuffer)
            .resize(192, 192)
            .png()
            .toFile('public/icon-192x192.png');
        
        await sharp(svgBuffer)
            .resize(512, 512)
            .png()
            .toFile('public/icon-512x512.png');
            
        await sharp(svgBuffer)
            .resize(180, 180)
            .png()
            .toFile('public/apple-touch-icon.png');
            
        console.log('Icons generated successfully.');
    } catch (e) {
        console.error(e);
    }
}

main();
