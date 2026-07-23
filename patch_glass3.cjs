const fs = require('fs');
let code = fs.readFileSync('index.css', 'utf8');

const replacement = `/* Liquid Glass Effects */
.liquid-glass-panel {
  background: linear-gradient(135deg, rgba(25, 25, 25, 0.4) 0%, rgba(25, 25, 25, 0.3) 100%),
              linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0.02) 100%);
  backdrop-filter: blur(30px) saturate(150%);
  -webkit-backdrop-filter: blur(30px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 20px 60px -10px rgba(0, 0, 0, 0.5), inset 1.5px 1.5px 0 0 rgba(255, 255, 255, 0.25), inset -1px -1px 0 0 rgba(255, 255, 255, 0.05);
  border-radius: 24px;
}

.liquid-glass-card {
  background: linear-gradient(135deg, rgba(25, 25, 25, 0.4) 0%, rgba(25, 25, 25, 0.25) 100%),
              linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 35%, rgba(255, 255, 255, 0.03) 100%);
  backdrop-filter: blur(30px) saturate(150%);
  -webkit-backdrop-filter: blur(30px) saturate(150%);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 16px 48px -12px rgba(0, 0, 0, 0.5), inset 1.5px 1.5px 0 0 rgba(255, 255, 255, 0.3), inset -1px -1px 0 0 rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.liquid-glass-card:hover {
  background: linear-gradient(135deg, rgba(35, 35, 35, 0.45) 0%, rgba(35, 35, 35, 0.3) 100%),
              linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 35%, rgba(255, 255, 255, 0.05) 100%);
  border-color: rgba(114, 240, 180, 0.3);
  box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.55), 0 0 24px rgba(114, 240, 180, 0.12), inset 1.5px 1.5px 0 0 rgba(255, 255, 255, 0.35), inset -1px -1px 0 0 rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.liquid-glass-button {
  background: linear-gradient(135deg, rgba(114, 240, 180, 0.15) 0%, rgba(114, 240, 180, 0.05) 100%);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid rgba(114, 240, 180, 0.2);
  box-shadow: 0 8px 24px -6px rgba(114, 240, 180, 0.2), inset 1.5px 1.5px 0 0 rgba(255, 255, 255, 0.35), inset -1px -1px 0 0 rgba(114, 240, 180, 0.1);
  border-radius: 9999px;
  color: #72f0b4;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.liquid-glass-button:hover {
  background: linear-gradient(135deg, rgba(114, 240, 180, 0.25) 0%, rgba(114, 240, 180, 0.1) 100%);
  box-shadow: 0 12px 32px -6px rgba(114, 240, 180, 0.3), inset 1.5px 1.5px 0 0 rgba(255, 255, 255, 0.45), inset -1px -1px 0 0 rgba(114, 240, 180, 0.15);
  transform: translateY(-1px);
}

.liquid-glass-tile {
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
  box-shadow: 0 16px 48px -8px rgba(0, 0, 0, 0.5), 0 0 20px rgba(114, 240, 180, 0.12), inset 1.5px 1.5px 0 0 rgba(255, 255, 255, 0.35), inset -1px -1px 0 0 rgba(255, 255, 255, 0.08) !important;
  transform: translateY(-4px) scale(1.03) !important;
}

.liquid-glass-hover {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.liquid-glass-hover:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%) !important;
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  border-color: rgba(114, 240, 180, 0.3) !important;
  box-shadow: 0 12px 32px -6px rgba(0, 0, 0, 0.4), 0 0 16px rgba(114, 240, 180, 0.1), inset 1.5px 1.5px 0 0 rgba(255, 255, 255, 0.25), inset -1px -1px 0 0 rgba(255, 255, 255, 0.05) !important;
  transform: translateY(-2px) scale(1.015) !important;
}

tr.liquid-glass-hover:hover {
  transform: none !important;
  box-shadow: inset 1.5px 1.5px 0 0 rgba(255, 255, 255, 0.15) !important;
}`;

code = code.replace(/\/\* Liquid Glass Effects \*\/[\s\S]*?(?=tr\.liquid-glass-hover:hover {[\s\S]*?})/, replacement.replace(/tr\.liquid-glass-hover:hover {[\s\S]*?}/, ''));

fs.writeFileSync('index.css', code);
