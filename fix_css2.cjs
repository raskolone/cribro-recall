const fs = require('fs');
let content = fs.readFileSync('index.css', 'utf8');

const oldTile = `.liquid-glass-tile {
  background: linear-gradient(135deg, rgba(25, 25, 25, 0.35) 0%, rgba(25, 25, 25, 0.2) 100%),
              linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 45%);
  backdrop-filter: blur(30px) saturate(150%);
  -webkit-backdrop-filter: blur(30px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.4), inset 1.5px 1.5px 0 0 rgba(255, 255, 255, 0.25), inset -1px -1px 0 0 rgba(255, 255, 255, 0.05);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
  border-radius: 16px;
}

.liquid-glass-tile:hover {
  background: linear-gradient(135deg, rgba(35, 35, 35, 0.4) 0%, rgba(35, 35, 35, 0.25) 100%),
              linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 45%);
  border-color: rgba(114, 240, 180, 0.3) !important;
  box-shadow: 0 16px 48px -8px rgba(0, 0, 0, 0.5), 0 0 30px 2px rgba(114, 240, 180, 0.4), inset 1.5px 1.5px 0 0 rgba(255, 255, 255, 0.35), inset -1px -1px 0 0 rgba(255, 255, 255, 0.08) !important;
  transform: translateY(-4px) scale(1.05) !important;
  z-index: 10;
}`;

const newTile = `.liquid-glass-tile {
  background: #0a0e17;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 1px 1px 0 0 rgba(255, 255, 255, 0.1);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
  border-radius: 24px;
  position: relative;
  overflow: hidden;
}

.liquid-glass-tile::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, transparent 100%);
  opacity: 0;
  transition: opacity 0.5s ease;
  pointer-events: none;
}

.liquid-glass-tile::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  left: -100%;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent);
  transform: skewX(-12deg);
  pointer-events: none;
}

.liquid-glass-tile:hover {
  background: #0e1524;
  border-color: rgba(16, 185, 129, 0.5) !important;
  box-shadow: 0 16px 36px rgba(16, 185, 129, 0.25), inset 1px 1px 0 0 rgba(255, 255, 255, 0.2) !important;
  transform: translateY(-6px) scale(1.05) !important;
  z-index: 10;
}

.liquid-glass-tile:hover::before {
  opacity: 1;
}

.liquid-glass-tile:hover::after {
  animation: shine 2.5s infinite ease-in-out;
}`;

if(content.includes(oldTile)) {
  content = content.replace(oldTile, newTile);
  fs.writeFileSync('index.css', content);
  console.log('index.css tile updated');
} else {
  console.log('oldTile not found in index.css');
}
