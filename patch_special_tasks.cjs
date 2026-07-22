const fs = require('fs');
let code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf8');

// 1. Add state
code = code.replace(
  /const \[userSets, setUserSets\] = useState<FlashcardSet\[\]>\(\[\]\);/g,
  'const [userSets, setUserSets] = useState<FlashcardSet[]>([]);\n  const [specialTasks, setSpecialTasks] = useState<any[]>([]);'
);

// 2. Add fetch in fetchUserLogsAndStats
const fetchReplacement = `
      try {
        const tasksQ = query(collection(db, 'specialTasks'), where('studentId', '==', userId));
        const tasksSnapshot = await getDocs(tasksQ);
        const tasksList = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tasksList.sort((a, b) => new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt).getTime() - new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt).getTime());
        setSpecialTasks(tasksList);
      } catch(e) { console.error("Error fetching special tasks", e); }
`;
code = code.replace(
  /setUserSets\(setsList\);\n      \} catch\(e\) \{ console\.error\("Error fetching sets", e\); \}/g,
  'setUserSets(setsList);\n      } catch(e) { console.error("Error fetching sets", e); }\n' + fetchReplacement
);

// 3. Render special tasks alongside sets
const renderReplacement = `
              {specialTasks.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-bold text-lg mb-3">Zadania specjalne</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {specialTasks.map(task => (
                      <Card key={task.id} className="p-4 cursor-pointer rounded-xl liquid-glass-hover bg-primary/5 border border-primary/20">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-lg">{task.title}</h4>
                          <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">
                            Zadanie specjalne
                          </span>
                        </div>
                        <p className="text-sm text-content-muted mb-4">Ilość zdań: {task.sentences?.length || 0}</p>
                        <div className="flex items-center justify-between text-xs font-mono text-content-muted">
                          <span className={task.status === 'completed' ? 'text-primary' : 'text-amber-500'}>
                            {task.status === 'completed' ? 'Ukończone' : 'Oczekujące'}
                          </span>
                          <span>{new Date(task.createdAt?.seconds ? task.createdAt.seconds * 1000 : task.createdAt).toLocaleDateString()}</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
`;

code = code.replace(
  /\{userSets\.length > 0 \? \(/g,
  renderReplacement + '\n              {userSets.length > 0 ? ('
);

fs.writeFileSync('components/admin/AdminPanel.tsx', code);
console.log('patched');
