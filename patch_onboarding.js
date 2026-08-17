const fs = require('fs');

// Patch Sidebar.tsx
let sidebar = fs.readFileSync('components/dashboard/Sidebar.tsx', 'utf8');
sidebar = sidebar.replace('onToggleCollapse?: () => void;', 'onToggleCollapse?: () => void;\n  onShowOnboarding?: () => void;');
sidebar = sidebar.replace('onToggleCollapse }) => {', 'onToggleCollapse, onShowOnboarding }) => {');
sidebar = sidebar.replace('isDesktopCollapsed, onToggleCollapse', 'isDesktopCollapsed, onToggleCollapse, onShowOnboarding');
sidebar = sidebar.replace('onClick={() => {}} isActive={false}>\n              {language === \'pl\' ? \'Pomoc\' : \'Help\'}', 'onClick={() => onShowOnboarding && onShowOnboarding()} isActive={false}>\n              {language === \'pl\' ? \'Pomoc\' : \'Help\'}');

fs.writeFileSync('components/dashboard/Sidebar.tsx', sidebar);

// Patch Dashboard.tsx
let dashboard = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');
dashboard = dashboard.replace('if (user && !user.onboardingCompleted) return true;', 'if (user && user.onboardingCompleted) return false;\n    if (user && !user.onboardingCompleted) return true;');
dashboard = dashboard.replace('onToggleCollapse={() => {', 'onShowOnboarding={() => setShowOnboarding(true)}\n        onToggleCollapse={() => {');

fs.writeFileSync('components/dashboard/Dashboard.tsx', dashboard);
console.log('Patched correctly');
