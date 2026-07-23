const fs = require('fs');

let content = fs.readFileSync('components/admin/AdminTestGenerator.tsx', 'utf8');

// 1. Add Drag and Drop handlers
const dndHandlers = `
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex === targetIndex || isNaN(sourceIndex) || !generatedQuestions) return;
    
    const newQuestions = [...generatedQuestions];
    const [removed] = newQuestions.splice(sourceIndex, 1);
    newQuestions.splice(targetIndex, 0, removed);
    setGeneratedQuestions(newQuestions);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
`;

// Insert the handlers before the return statement of AdminTestGenerator
content = content.replace(/  return \(/, dndHandlers + '\n  return (');

// 2. Modify the mapped element
const oldMapStart = `{generatedQuestions.map((q, i) => (
                  <div key={q.id} className="p-6 bg-base-200/40 backdrop-blur-md border border-white/10 rounded-2xl space-y-6 relative group transition-all">`;

const newMapStart = `{generatedQuestions.map((q, i) => (
                  <div 
                    key={q.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, i)}
                    className="p-4 bg-base-200/40 backdrop-blur-md border border-white/10 rounded-xl space-y-4 relative group transition-all cursor-grab active:cursor-grabbing hover:border-primary/50"
                  >`;

content = content.replace(oldMapStart, newMapStart);

// 3. Compact UI changes
content = content.replace(/<div className="flex-1 space-y-6 w-full overflow-hidden">/g, '<div className="flex-1 space-y-3 w-full overflow-hidden">');
content = content.replace(/<textarea\n\s*value=\{q\.prompt\}/g, `<div className="space-y-2">
                            {q.instruction && (
                              <input 
                                value={q.instruction}
                                onChange={(e) => {
                                  const newQ = [...generatedQuestions];
                                  newQ[i].instruction = e.target.value;
                                  setGeneratedQuestions(newQ);
                                }}
                                className="w-full bg-base-100 border border-white/10 rounded-lg p-2 text-primary text-sm font-bold outline-none focus:border-primary/50"
                                placeholder="Polecenie"
                              />
                            )}
                            <textarea
                              value={q.prompt}`);

content = content.replace(/className="w-full bg-base-100 border border-white\/10 rounded-xl p-4 text-white text-lg font-medium outline-none focus:border-primary\/50 focus:ring-1 focus:ring-primary\/50 transition-all resize-y min-h-\[80px\]"/g, 
  `className="w-full bg-base-100 border border-white/10 rounded-lg p-3 text-white text-base outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all resize-y min-h-[60px]"`);

content = content.replace(/<div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4 p-4 rounded-xl bg-primary\/5 border border-primary\/10">/g, 
  `<div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2 p-3 rounded-lg bg-primary/5 border border-primary/10">`);

fs.writeFileSync('components/admin/AdminTestGenerator.tsx', content);
