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

function generateSpiral() {
    let turns = 7;
    let cx = 350;
    let cy = 150;
    let pts = [];
    for (let i = 0; i <= 360 * turns; i += 3) {
        let angle = (i * Math.PI) / 180; 
        let r = (110 * i) / (360 * turns);
        let x = cx + r * Math.cos(angle);
        let y = cy + r * Math.sin(angle);
        pts.push({x, y});
    }
    
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} `;
    for(let i=1; i<pts.length; i++) {
        d += `L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} `;
    }
    return d;
}

fs.writeFileSync('yarn_center_paths.json', JSON.stringify({
    tangle: generateTangle(),
    spiral: generateSpiral()
}));
console.log("Wrote yarn_center_paths.json");
