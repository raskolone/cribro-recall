const fs = require('fs');

// Generate Tangle
function generateTangle() {
    let pts = [];
    let numPoints = 400;
    // We want it to stay mostly inside a circle of radius 100, centered at 150, 150
    for(let i=0; i<numPoints; i++) {
        let t = i * 0.1;
        // Lissajous-like curve with noise
        let r = 85 + 10 * Math.sin(t * 3.1) + 15 * Math.cos(t * 7.3);
        let x = 150 + r * Math.cos(t * 1.1) * Math.sin(t * 0.35);
        let y = 150 + r * Math.sin(t * 1.3) * Math.cos(t * 0.45);
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
    // Spiral centered at 550, 150
    // Starts from center, goes outwards, or starts from outside and goes in.
    // The straight line ends at 400 150.
    // Spiral outside radius is 90. So left edge of spiral is 550 - 90 = 460.
    // Wait, let's make the line go from 300 to 460.
    
    // Let's generate a continuous path that starts from 300 150, goes to 460 150, then spirals IN.
    let d = "M 300 150 L 460 150 ";
    // Spiral from outside (r=90) to inside (r=10)
    let turns = 7;
    let cx = 550;
    let cy = 150;
    let pts = [];
    for (let i = 0; i <= 360 * turns; i += 5) {
        let angle = Math.PI - (i * Math.PI) / 180; // Start at PI (left side) and rotate clockwise/counterclockwise
        // Wait, if it starts at left side, angle is PI.
        // Let's decrease radius from 90 to 10
        let r = 90 - (80 * i) / (360 * turns);
        let x = cx + r * Math.cos(angle);
        let y = cy + r * Math.sin(angle);
        pts.push({x, y});
    }
    
    for(let i=0; i<pts.length; i++) {
        d += `L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} `;
    }
    return d;
}

console.log(generateTangle().substring(0, 100));
console.log(generateSpiral().substring(0, 100));
