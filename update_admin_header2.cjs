const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

const target = `<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span>{i18n.t("Teacher Panel")}</span>
            <span className="text-xs font-mono uppercase bg-primary/20 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-bold">
              Panel Nauczyciela
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-content-muted mt-1">
            Zarządzaj kursantami, edytuj opisy i prompty AI, śledź statystyki oraz historię lekcji i sesji
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAIModal(true)}
            className="px-3.5 py-2 bg-base-200/80 text-primary border border-primary/40 rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/10 transition-colors flex items-center gap-2"
          >
            <Sparkles size={16} />
            {i18n.t("✨ AI Lesson Generator")}
          </button>
          <button
            onClick={() => setShowCreateStudentModal(true)}
            className="px-3.5 py-2 bg-primary text-black rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-lg"
          >
            <Plus size={16} />
            {i18n.t("Dodaj kursanta")}
          </button>
        </div>
      </div>`;

const replacement = `<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 sm:pt-0 pl-7 sm:pl-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex flex-wrap items-center gap-3">
            <span>{i18n.t("Teacher Panel")}</span>
            <span className="text-xs font-mono uppercase bg-primary/20 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-bold whitespace-nowrap">
              Panel Nauczyciela
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-content-muted mt-1 leading-relaxed">
            Zarządzaj kursantami, edytuj opisy i prompty AI, śledź statystyki oraz historię lekcji i sesji
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAIModal(true)}
            className="px-3.5 py-2 bg-base-200/80 text-primary border border-primary/40 rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/10 transition-colors flex items-center gap-2 shrink-0"
          >
            <Sparkles size={16} />
            {i18n.t("✨ AI Lesson Generator")}
          </button>
          <button
            onClick={() => setShowCreateStudentModal(true)}
            className="px-3.5 py-2 bg-primary text-black rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-lg shrink-0"
          >
            <Plus size={16} />
            {i18n.t("Dodaj kursanta")}
          </button>
        </div>
      </div>`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('components/admin/AdminPanel.tsx', code);
  console.log('AdminPanel header updated successfully');
} else {
  // Let's replace just the first div and h1
  code = code.replace(
    '<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">',
    '<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 sm:pt-0 pl-7 sm:pl-0">'
  );
  fs.writeFileSync('components/admin/AdminPanel.tsx', code);
  console.log('Replaced first div in header');
}
