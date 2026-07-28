const sharp = require('sharp');
const fs = require('fs');

async function main() {
    try {
        const svgBuffer = fs.readFileSync('public/favicon.svg');
        
        await sharp({
            create: {
                width: 192,
                height: 192,
                channels: 4,
                background: { r: 18, g: 18, b: 18, alpha: 1 } // #121212
            }
        })
        .composite([{ input: await sharp(svgBuffer).resize(140, 140).toBuffer(), gravity: 'center' }])
        .png()
        .toFile('public/icon-192x192.png');
        
        await sharp({
            create: {
                width: 512,
                height: 512,
                channels: 4,
                background: { r: 18, g: 18, b: 18, alpha: 1 } // #121212
            }
        })
        .composite([{ input: await sharp(svgBuffer).resize(360, 360).toBuffer(), gravity: 'center' }])
        .png()
        .toFile('public/icon-512x512.png');
            
        await sharp({
            create: {
                width: 180,
                height: 180,
                channels: 4,
                background: { r: 18, g: 18, b: 18, alpha: 1 } // #121212
            }
        })
        .composite([{ input: await sharp(svgBuffer).resize(130, 130).toBuffer(), gravity: 'center' }])
        .png()
        .toFile('public/apple-touch-icon.png');
            
        console.log('Icons generated successfully.');
    } catch (e) {
        console.error(e);
    }
}

main();
