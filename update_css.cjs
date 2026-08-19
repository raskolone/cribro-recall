const fs = require('fs');
let css = fs.readFileSync('index.css', 'utf8');

const oldTileCssRegex = /\.liquid-glass-tile\s*\{[\s\S]*?\.liquid-glass-tile:hover::after\s*\{[\s\S]*?\}/;

const newTileCss = `.liquid-glass-tile {
  background: #0a0e17;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), inset 1px 1px 0 0 rgba(255, 255, 255, 0.08);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, background 0.25s ease !important;
  border-radius: 20px;
  position: relative;
  overflow: hidden;
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.liquid-glass-tile::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, transparent 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.liquid-glass-tile::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  left: -100%;
  background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.08), transparent);
  transform: skewX(-12deg);
  pointer-events: none;
}

@media (hover: hover) and (pointer: fine) {
  .liquid-glass-tile:hover {
    background: #0e1524;
    border-color: rgba(16, 185, 129, 0.45) !important;
    box-shadow: 0 14px 32px -4px rgba(0, 0, 0, 0.6), 0 0 24px rgba(16, 185, 129, 0.2), inset 1px 1px 0 0 rgba(255, 255, 255, 0.15) !important;
    transform: translateY(-3px) scale(1.02) !important;
    -webkit-transform: translateY(-3px) scale(1.02) !important;
    z-index: 50 !important;
  }

  .liquid-glass-tile:hover::before {
    opacity: 1;
  }

  .liquid-glass-tile:hover::after {
    animation: shine 2.5s infinite ease-in-out;
  }
}

@media (hover: none) {
  .liquid-glass-tile:active {
    background: #0e1524;
    border-color: rgba(16, 185, 129, 0.4) !important;
    transform: scale(0.98) !important;
    -webkit-transform: scale(0.98) !important;
  }
}`;

if (oldTileCssRegex.test(css)) {
  css = css.replace(oldTileCssRegex, newTileCss);
  fs.writeFileSync('index.css', css);
  console.log('index.css updated with optimized tile CSS');
} else {
  console.log('Regex match failed in index.css');
}
