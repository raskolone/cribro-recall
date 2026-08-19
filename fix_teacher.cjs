const fs = require('fs');
let content = fs.readFileSync('components/dashboard/TeacherQuickAccess.tsx', 'utf8');

const importOld = `import { BarChart2, History, User as UserIcon, ClipboardList, Search } from 'lucide-react';`;
const importNew = `import { BarChart2, History, User as UserIcon, ClipboardList, Search, BookOpen, Database } from 'lucide-react';`;
content = content.replace(importOld, importNew);

const gridOld = `<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card onClick={() => onNavigate('admin-stats')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors liquid-glass-tile">
          <BarChart2 className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base">{i18n.t("Statystyki")}</span>
        </Card>
        <Card onClick={() => onNavigate('admin-history')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors liquid-glass-tile">
          <History className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base">{i18n.t("Historia")}</span>
        </Card>
        <Card onClick={() => onNavigate('admin-profile')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors liquid-glass-tile">
          <UserIcon className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base">{i18n.t("Profil kursanta")}</span>
        </Card>
        <Card onClick={() => onNavigate('admin-tests')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors liquid-glass-tile">
          <ClipboardList className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base">{i18n.t("Testy")}</span>
        </Card>
      </div>`;

const gridNew = `<div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        <Card onClick={() => onNavigate('admin-stats')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors liquid-glass-tile relative z-0">
          <BarChart2 className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base text-center">{i18n.t("Statystyki")}</span>
        </Card>
        <Card onClick={() => onNavigate('admin-history')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors liquid-glass-tile relative z-0">
          <History className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base text-center">{i18n.t("Historia")}</span>
        </Card>
        <Card onClick={() => onNavigate('admin-profile')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors liquid-glass-tile relative z-0">
          <UserIcon className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base text-center">{i18n.t("Profil kursanta")}</span>
        </Card>
        <Card onClick={() => onNavigate('admin-tests')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors liquid-glass-tile relative z-0">
          <ClipboardList className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base text-center">{i18n.t("Testy")}</span>
        </Card>
        <Card onClick={() => onNavigate('homework')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors liquid-glass-tile relative z-0">
          <BookOpen className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base text-center">{i18n.t("Praca domowa")}</span>
        </Card>
        <Card onClick={() => onNavigate('topic-database')} className="cursor-pointer hover:border-primary/50 flex flex-col items-center justify-center p-6 gap-3 transition-colors liquid-glass-tile relative z-0">
          <Database className="w-8 h-8 text-primary" />
          <span className="font-bold text-sm md:text-base text-center">{i18n.t("Baza wiedzy / Zasoby")}</span>
        </Card>
      </div>`;

if(content.includes(gridOld)) {
  content = content.replace(gridOld, gridNew);
  fs.writeFileSync('components/dashboard/TeacherQuickAccess.tsx', content);
  console.log('TeacherQuickAccess updated successfully.');
} else {
  console.log('gridOld not found');
}
