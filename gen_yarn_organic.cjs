const fs = require('fs');

function generateTangle() {
    let pts = [];
    let numPoints = 800;
    let cx = 350;
    let cy = 150;
    for(let i=0; i<numPoints; i++) {
        let t = i * 0.12;
        let r = 100 + 20 * Math.sin(t * 3.1) * Math.cos(t * 5.7);
        let x = cx + (r * Math.cos(t * 1.3) * Math.sin(t * 0.45));
        let y = cy + (r * Math.sin(t * 1.7) * Math.cos(t * 0.35));
        
        x += 8 * Math.sin(t * 11);
        y += 8 * Math.cos(t * 13);
        
        pts.push({x, y});
    }
    
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} `;
    for(let i=1; i<pts.length-1; i++) {
        let xc = (pts[i].x + pts[i+1].x) / 2;
        let yc = (pts[i].y + pts[i+1].y) / 2;
        d += `Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}, ${xc.toFixed(1)} ${yc.toFixed(1)} `;
    }
    return d;
}

function generateOrganicSpiral() {
    let turns = 7;
    let cx = 350;
    let cy = 150;
    let pts = [];
    let maxRadius = 105;
    
    for (let i = 0; i <= 360 * turns; i += 3) {
        let angle = (i * Math.PI) / 180; 
        
        // Base radius grows steadily
        let baseR = (maxRadius * i) / (360 * turns);
        
        // Hand-drawn/yarn imperfections:
        // 1. Thread crossing over itself (wavy radius)
        let threadCrossing = 5 * Math.sin(angle * 7);
        
        // 2. Slow organic wobble (makes it slightly imperfectly round)
        let handDrawnWobble = 3 * Math.cos(angle * 1.5 - i * 0.01);
        
        // 3. Very slight oval squish
        let ovalX = 1.0;
        let ovalY = 0.95;

        let r = baseR + threadCrossing + handDrawnWobble;
        if (r < 0) r = 0;
        
        let x = cx + (r * Math.cos(angle) * ovalX);
        let y = cy + (r * Math.sin(angle) * ovalY);
        pts.push({x, y});
    }
    
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} `;
    for(let i=1; i<pts.length-1; i++) {
        let xc = (pts[i].x + pts[i+1].x) / 2;
        let yc = (pts[i].y + pts[i+1].y) / 2;
        d += `Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}, ${xc.toFixed(1)} ${yc.toFixed(1)} `;
    }
    return d;
}

fs.writeFileSync('yarn_organic_paths.json', JSON.stringify({
    tangle: generateTangle(),
    spiral: generateOrganicSpiral()
}));
console.log("Wrote yarn_organic_paths.json");
