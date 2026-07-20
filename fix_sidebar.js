import fs from 'fs';

let file = 'components/dashboard/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Add ids to NavLinks
content = content.replace(
  /<NavLink icon=\{<Library size=\{20\} \/>\} /g,
  '<NavLink id="tour-flashcards" icon={<Library size={20} />} '
);
content = content.replace(
  /<NavLink icon=\{<History size=\{20\} \/>\} /g,
  '<NavLink id="tour-history" icon={<History size={20} />} '
);
content = content.replace(
  /<NavLink icon=\{<LayoutDashboard size=\{20\} \/>\} /g,
  '<NavLink id="tour-generator" icon={<LayoutDashboard size={20} />} '
);

fs.writeFileSync(file, content);
console.log("Updated Sidebar.tsx");
