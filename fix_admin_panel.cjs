const fs = require('fs');
let content = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

if (!content.includes("import HomeworkScreen")) {
  content = content.replace("import i18n from 'i18next';", "import i18n from 'i18next';\nimport HomeworkScreen from '../dashboard/HomeworkScreen';");
}

const homeworkTabHeader = `              {activeTab === 'tests' && 'Generowanie i przegląd testów AI'}
              {activeTab === 'vocabulary' && 'Zestawy słówek i Zadania Specjalne AI'}
              {activeTab === 'homework' && 'Praca domowa kursanta'}`;

if (!content.includes("activeTab === 'homework' && 'Praca")) {
  content = content.replace("{activeTab === 'vocabulary' && 'Zestawy słówek i Zadania Specjalne AI'}", "{activeTab === 'vocabulary' && 'Zestawy słówek i Zadania Specjalne AI'}\n              {activeTab === 'homework' && 'Praca domowa kursanta'}");
}

const homeworkTabContent = `          {activeTab === 'homework' && (
            <div className="space-y-6">
              <HomeworkScreen 
                 // We need to pass the selected student to HomeworkScreen if possible.
                 // HomeworkScreen handles its own data fetching, but usually it's tied to the logged in user or admin can assign.
              />
            </div>
          )}`;

if (!content.includes("activeTab === 'homework' && (")) {
  content = content.replace("{activeTab === 'vocabulary' && (", homeworkTabContent + "\n\n          {activeTab === 'vocabulary' && (");
}

fs.writeFileSync('components/admin/AdminPanel.tsx', content);
console.log('AdminPanel updated with Homework tab');
