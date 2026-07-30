import os

replacements = {
    "(function(){ try { localStorage.setItem('checked_sets', JSON.stringify(updated); } catch(e) {} })());": "(function(){ try { localStorage.setItem('checked_sets', JSON.stringify(updated)); } catch(e) {} })();",
    "(function(){ try { localStorage.setItem(`ai_teacher_stats_${user?.id}`, JSON.stringify({ data, timestamp: Date.now(); } catch(e) {} })() }));": "(function(){ try { localStorage.setItem(`ai_teacher_stats_${user?.id}`, JSON.stringify({ data, timestamp: Date.now() })); } catch(e) {} })();",
    "(function(){ try { localStorage.setItem('ai_vocab_basket', JSON.stringify(basketWords); } catch(e) {} })());": "(function(){ try { localStorage.setItem('ai_vocab_basket', JSON.stringify(basketWords)); } catch(e) {} })();",
    "(function(){ try { localStorage.setItem('cribro_show_learning_progress_chart', JSON.stringify(show); } catch(e) {} })());": "(function(){ try { localStorage.setItem('cribro_show_learning_progress_chart', JSON.stringify(show)); } catch(e) {} })();"
}

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    modified = False
    for old, new in replacements.items():
        if old in content:
            content = content.replace(old, new)
            modified = True
            
    # Also handle the literal string with variable interpolation correctly
    bad_stats = "(function(){ try { localStorage.setItem(`ai_teacher_stats_${user?.id}`, JSON.stringify({ data, timestamp: Date.now(); } catch(e) {} })() }));"
    good_stats = "(function(){ try { localStorage.setItem(`ai_teacher_stats_${user?.id}`, JSON.stringify({ data, timestamp: Date.now() })); } catch(e) {} })();"
    if bad_stats in content:
        content = content.replace(bad_stats, good_stats)
        modified = True
        
    if modified:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed {filepath}")

for root, dirs, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root:
        continue
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            fix_file(os.path.join(root, file))
