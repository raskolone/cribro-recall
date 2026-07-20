import fs from 'fs';
let file = 'services/geminiService.ts';
let content = fs.readFileSync(file, 'utf-8');

// Replace:
//       try {
//   let response;
//   try {
// With:
//   let response;
//   try {

content = content.replace(/\s*try \{\n\s*let response;\n\s*try \{/g, '\n  let response;\n  try {');

fs.writeFileSync(file, content);
console.log("Fixed extra try");
