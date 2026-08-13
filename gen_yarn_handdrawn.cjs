const fs = require('fs');

function generateTangle() {
    let pts = [];
    let numPoints = 600;
    let cx = 350;
    let cy = 150;
    
    // Generujemy chaotyczny, nierówny kłębek (unikanie regularnych wzorów typu kwiatek)
    for(let i=0; i<numPoints; i++) {
        let t = i * 0.15;
        // Używamy ułamkowych częstotliwości, żeby uniknąć symetrii
        let r = 70 + 45 * Math.sin(t * 1.31) * Math.cos(t * 2.17) + 10 * Math.sin(t * 0.83);
        let x = cx + r * Math.cos(t * 1.11) + 20 * Math.sin(t * 2.45);
        let y = cy + r * Math.sin(t * 1.23) + 20 * Math.cos(t * 2.77);
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

function generateHandDrawnCircle() {
    let turns = 12; // Zwijamy to w okrąg wielokrotnie
    let cx = 350;
    let cy = 150;
    let pts = [];
    let baseRadius = 90;
    
    for (let i = 0; i <= 360 * turns; i += 5) {
        let angle = (i * Math.PI) / 180; 
        
        // Brak stałych wielokrotności kąta = brak "płatków/kwiatków". 
        // Wprowadzamy losowe, łagodne zakłócenia symulujące drżenie ręki.
        let handDrawnWobble = 
            9 * Math.sin(angle * 0.77) + 
            6 * Math.cos(angle * 1.23) + 
            4 * Math.sin(angle * 2.61);
            
        // Lekkie "pływanie" środka kłębka, typowe przy odręcznym rysowaniu koła
        let currentCx = cx + 8 * Math.sin(angle * 0.45);
        let currentCy = cy + 8 * Math.cos(angle * 0.61);

        let r = baseRadius + handDrawnWobble;
        
        let x = currentCx + (r * Math.cos(angle));
        let y = currentCy + (r * Math.sin(angle));
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

fs.writeFileSync('yarn_handdrawn_paths.json', JSON.stringify({
    tangle: generateTangle(),
    spiral: generateHandDrawnCircle()
}));
console.log("Wrote yarn_handdrawn_paths.json");
