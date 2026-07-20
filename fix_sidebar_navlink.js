import fs from 'fs';

let file = 'components/dashboard/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  /const NavLink: React\.FC<\{/,
  "const NavLink: React.FC<{\n  id?: string;"
);
content = content.replace(
  /isCollapsed\?: boolean;\n  children: React\.ReactNode;\n\}> = \(\{ onClick, isActive, icon, isCollapsed, children \}\) => \(\n  <button/,
  "isCollapsed?: boolean;\n  children: React.ReactNode;\n}> = ({ id, onClick, isActive, icon, isCollapsed, children }) => (\n  <button id={id}"
);

fs.writeFileSync(file, content);
console.log("Updated Sidebar NavLink props");
