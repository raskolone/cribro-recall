// Generate Tangle
function generateTangle() {
    let pts = [];
    let numPoints = 800; // Increased points for a much denser, realistic tangle
    for(let i=0; i<numPoints; i++) {
        let t = i * 0.12;
        // complex mathematical knot for realistic yarn ball
        let r = 90 + 15 * Math.sin(t * 3.1) * Math.cos(t * 5.7);
        let x = 160 + (r * Math.cos(t * 1.3) * Math.sin(t * 0.45));
        let y = 150 + (r * Math.sin(t * 1.7) * Math.cos(t * 0.35));
        
        // Add a bit of 3D wrapping effect by squishing the edges occasionally
        x += 5 * Math.sin(t * 11);
        y += 5 * Math.cos(t * 13);
        
        pts.push({x, y});
    }
    
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} `;
    for(let i=1; i<pts.length-1; i++) {
        let xc = (pts[i].x + pts[i+1].x) / 2;
        let yc = (pts[i].y + pts[i+1].y) / 2;
        d += `Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}, ${xc.toFixed(1)} ${yc.toFixed(1)} `;
    }
    let last = pts[pts.length-1];
    d += `Q ${last.x.toFixed(1)} ${last.y.toFixed(1)}, 300 150`;
    return d;
}

function generateSpiral() {
    let d = "M 300 150 L 440 150 ";
    let turns = 7;
    let cx = 540;
    let cy = 150;
    let pts = [];
    // From angle PI down to smaller radius
    for (let i = 0; i <= 360 * turns; i += 3) {
        let angle = Math.PI + (i * Math.PI) / 180; 
        let r = 100 - (90 * i) / (360 * turns);
        let x = cx + r * Math.cos(angle);
        let y = cy + r * Math.sin(angle);
        pts.push({x, y});
    }
    
    for(let i=0; i<pts.length; i++) {
        d += `L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} `;
    }
    return d;
}

const fs = require('fs');
fs.writeFileSync('yarn_paths.json', JSON.stringify({
    tangle: generateTangle(),
    spiral: generateSpiral()
}));
console.log("Wrote yarn_paths.json");
