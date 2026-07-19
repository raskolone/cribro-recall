import fs from 'fs';
let content = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');

// Remove onBlur
content = content.replace(/onBlur=\{\(\) => handleSaveProfile\(true\)\}/g, '');

// Fix select onChange
const selectTarget = `                  onChange={(e) => {
                    const newForm = { ...profileForm, level: e.target.value };
                    setProfileForm(newForm);
                    handleSaveProfile(true, newForm);
                  }}`;

const selectReplacement = `                  onChange={(e) => {
                    setProfileForm(prev => ({ ...prev, level: e.target.value }));
                  }}`;

content = content.replace(selectTarget, selectReplacement);

fs.writeFileSync('components/admin/AdminPanel.tsx', content);
console.log("Patched correctly");
