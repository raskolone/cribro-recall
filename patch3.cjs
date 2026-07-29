const fs = require('fs');
let file = fs.readFileSync('components/dashboard/Dashboard.tsx', 'utf8');
file = file.replace(
  `| 'tests' | 'topic-database';`,
  `| 'tests' | 'topic-database' | 'student-stats';`
);
file = file.replace(
  `import StudentTestsScreen from '../tests/StudentTestsScreen';`,
  `import StudentTestsScreen from '../tests/StudentTestsScreen';\nimport StudentStatsScreen from './StudentStatsScreen';`
);
file = file.replace(
  `{currentView === 'tests' && <StudentTestsScreen />}`,
  `{currentView === 'tests' && <StudentTestsScreen />}\n        {currentView === 'student-stats' && <StudentStatsScreen />}`
);
fs.writeFileSync('components/dashboard/Dashboard.tsx', file);
