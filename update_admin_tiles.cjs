const fs = require('fs');
let content = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

// 1. Find the grid and replace grid-cols-5 with grid-cols-3, and update the array.
const oldGrid = `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {[
            {
              id: 'profile',
              title: 'Profil kursanta',
              badge: 'Dane i AI',
              desc: 'Dane osobowe, poziom i wytyczne dla AI',
              icon: UserIcon
            },
            {
              id: 'stats',
              title: 'Statystyki',
              badge: 'Analityka',
              desc: 'Logowania, zadania, zdania i wyniki',
              icon: BarChart2
            },
            {
              id: 'history',
              title: 'Historia lekcji i sesji',
              badge: 'Lekcje + App',
              desc: 'Dziennik lekcji oraz ćwiczenia w aplikacji',
              icon: Clock
            },
            {
              id: 'tests',
              title: 'Testy i sprawdziany',
              badge: 'Sprawdziany',
              desc: 'Generowanie i podgląd testów AI',
              icon: Award
            },
            {
              id: 'vocabulary',
              title: 'Słownictwo i zadania',
              badge: 'Słówka + AI',
              desc: 'Zestawy słówek i Zadania Specjalne AI',
              icon: BookMarked
            }
          ].map((tile) => {`;

const newGrid = `{/* 6 KAFELKÓW GRID (Tiles view) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              id: 'profile',
              title: 'Profil kursanta',
              badge: 'Dane i AI',
              desc: 'Dane osobowe, poziom i wytyczne dla AI',
              icon: UserIcon
            },
            {
              id: 'stats',
              title: 'Statystyki',
              badge: 'Analityka',
              desc: 'Logowania, zadania, zdania i wyniki',
              icon: BarChart2
            },
            {
              id: 'history',
              title: 'Historia lekcji i sesji',
              badge: 'Lekcje + App',
              desc: 'Dziennik lekcji oraz ćwiczenia w aplikacji',
              icon: Clock
            },
            {
              id: 'tests',
              title: 'Testy i sprawdziany',
              badge: 'Sprawdziany',
              desc: 'Generowanie i podgląd testów AI',
              icon: Award
            },
            {
              id: 'homework',
              title: 'Praca domowa',
              badge: 'Zadania domowe',
              desc: 'Przypisuj prace domowe wybranym kursantom',
              icon: BookOpen
            },
            {
              id: 'vocabulary',
              title: 'Słownictwo i zadania',
              badge: 'Słówka + AI',
              desc: 'Zestawy słówek i Zadania Specjalne AI',
              icon: BookMarked
            }
          ].map((tile) => {`;

// We also need to add BookOpen import if it's not there.
// Let's check imports first.

if (content.includes(oldGrid)) {
  content = content.replace(oldGrid, newGrid);
  
  // Now replace the tile styling to use liquid-glass-tile
  const oldTileStyle = `className={\`p-4 rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden group flex flex-col justify-between \${
                  isActive
                    ? 'bg-primary/15 border-2 border-primary shadow-[0_0_25px_rgba(114,240,180,0.25)]'
                    : selectedUser
                    ? 'bg-base-200/60 hover:bg-base-200/90 border border-white/10 hover:border-primary/50 hover:shadow-lg'
                    : 'bg-base-200/40 hover:bg-base-200/70 border border-white/10 hover:border-amber-500/50 hover:shadow-lg'
                }\`}`;
                
  const newTileStyle = `className={\`p-6 cursor-pointer flex flex-col justify-between liquid-glass-tile \${
                  isActive
                    ? 'border-primary shadow-[0_0_25px_rgba(114,240,180,0.35)] ring-2 ring-primary/20 scale-105 z-10'
                    : selectedUser
                    ? ''
                    : 'opacity-80'
                }\`}`;
                
  if (content.includes(oldTileStyle)) {
     content = content.replace(oldTileStyle, newTileStyle);
  } else {
     console.log('oldTileStyle not found!');
  }

  // Find 5 KAFELKÓW string to replace
  content = content.replace('{/* 5 KAFELKÓW GRID (Tiles view) */}', '');

  fs.writeFileSync('components/admin/AdminPanel.tsx', content);
  console.log('AdminPanel updated successfully.');
} else {
  console.log('oldGrid not found');
}
