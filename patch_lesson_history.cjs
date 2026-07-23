const fs = require('fs');

let content = fs.readFileSync('components/dashboard/LessonHistoryScreen.tsx', 'utf8');

const target = `      Promise.all([fetchLessons(), fetchPracticeLogs()])
        .then(([fetchedLessons, fetchedLogs]) => {
          setLessons(fetchedLessons);
          setPracticeLogs(fetchedLogs);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));`;

const replacement = `      Promise.allSettled([fetchLessons(), fetchPracticeLogs()])
        .then((results) => {
          if (results[0].status === 'fulfilled') {
            setLessons(results[0].value);
          } else {
            console.error('Failed to fetch lessons:', results[0].reason);
          }
          if (results[1].status === 'fulfilled') {
            setPracticeLogs(results[1].value);
          } else {
            console.error('Failed to fetch practice logs:', results[1].reason);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));`;

content = content.replace(target, replacement);

fs.writeFileSync('components/dashboard/LessonHistoryScreen.tsx', content);
