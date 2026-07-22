const fs = require('fs');
let code = fs.readFileSync('components/admin/TeacherDashboardStats.tsx', 'utf8');

const target = `  // Process logs for the selected user
  const userPerformanceData = userLogs.map(log => {
    const results = log.results || {};
    const total = Object.keys(results).length;
    const correct = Object.values(results).filter(r => r).length;
    const errors = total - correct;
    return {
      date: new Date(log.date).toLocaleDateString(),
      poprawne: correct,
      błędy: errors,
      razem: total
    };
  }).slice(-10); // last 10 sessions`;

const replacement = `  // Process logs for the selected user
  const userPerformanceData = userLogs.map(log => {
    const total = log.totalWords || 0;
    const correct = log.score || 0;
    const errors = total - correct > 0 ? total - correct : 0;
    return {
      date: new Date(log.date).toLocaleDateString(),
      poprawne: correct,
      błędy: errors,
      razem: total
    };
  }).slice(-10); // last 10 sessions`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('components/admin/TeacherDashboardStats.tsx', code);
  console.log('patched');
} else {
  console.log('target not found');
}
