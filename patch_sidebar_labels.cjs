const fs = require('fs');
const file = 'components/dashboard/Sidebar.tsx';
let content = fs.readFileSync(file, 'utf8');

// Move Debugging to bottom
const adminBlockRegex = /\{isAdmin && \([\s\S]*?<\/div>\n          \)\}\n/;
const adminBlockMatch = content.match(adminBlockRegex);
if(adminBlockMatch) {
  content = content.replace(adminBlockRegex, '');
  const settingsPos = content.indexOf('<NavLink icon={<Settings size={20} />}');
  const adminBlockModified = adminBlockMatch[0].replace(
    /\{language === 'pl' \? 'Zgłoszenia błędów' : 'Debugging'\}/,
    "{language === 'pl' ? 'Zgłoszone błędy' : 'Reported bugs'}"
  );
  content = content.slice(0, settingsPos) + adminBlockModified + content.slice(settingsPos);
}

// Replace 'Słownictwo' with 'Moje słownictwo'
content = content.replace(
  /\{language === 'pl' \? 'Słownictwo' : 'My Word Lists'\}/g,
  "{language === 'pl' ? 'Moje słownictwo' : 'My Word Lists'}"
);

// Replace 'Panel główny' with 'Panel nauczyciela'
content = content.replace(
  /\{isTeacher \? \(language === 'pl' \? 'Panel główny' : 'Dashboard'\) : \(language === 'pl' \? 'Panel ćwiczeniowy' : 'Practice Panel'\)\}/g,
  "{isTeacher ? (language === 'pl' ? 'Panel nauczyciela' : 'Dashboard') : (language === 'pl' ? 'Panel kursanta' : 'Practice Panel')}"
);

// Replace 'Widok kursanta' with 'Panel kursanta'
content = content.replace(
  /\{language === 'pl' \? 'Widok kursanta' : 'Student View'\}/g,
  "{language === 'pl' ? 'Panel kursanta' : 'Student View'}"
);

fs.writeFileSync(file, content);
