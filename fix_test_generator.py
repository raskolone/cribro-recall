import re

with open('components/admin/AdminTestGenerator.tsx', 'r') as f:
    text = f.read()

# Fix the broken ending
text = re.sub(r'\s*\)\}\s*</div>\s*</div>\s*\);\s*\};\s*export default AdminTestGenerator;', '\n  );\n};\nexport default AdminTestGenerator;', text)

# Now, inject the dropdown.
old_return = '''  return (
    <div className="space-y-8">'''

new_return = '''  return (
    <div className="space-y-8">
      {(!initialUser && users.length > 0) && (
        <Card className="p-6 bg-base-200/50">
          <label className="block text-sm font-bold text-content-muted mb-2">Wybierz kursanta</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full bg-base-100 border border-white/10 rounded-xl p-3 outline-none focus:border-primary/50 text-white font-medium"
          >
            <option value="">-- Wybierz kursanta --</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.firstName || u.lastName ? f"{u.firstName or ''} {u.lastName or ''}".strip() : u.username}
              </option>
            ))}
          </select>
        </Card>
      )}
      {!user ? (
         <div className="text-center p-8 text-content-muted">Proszę wybrać kursanta, aby wygenerować test.</div>
      ) : (
        <div className="space-y-8">'''

# replace JS string interpolation inside Python f-string or just direct string
new_return = new_return.replace('f"{u.firstName or \'\'} {u.lastName or \'\'}".strip()', '`${u.firstName || \'\'} ${u.lastName || \'\'}`.trim()')

text = text.replace(old_return, new_return)

# Also we need to close the `{!user ? ( ... ) : ( <div className="space-y-8"> ...` block at the end.
# So at the end, before `  );`, we need `        </div>\n      )}`
text = re.sub(r'\n  \);\n\};\nexport default AdminTestGenerator;', '\n        </div>\n      )}\n    </div>\n  );\n};\nexport default AdminTestGenerator;', text)


with open('components/admin/AdminTestGenerator.tsx', 'w') as f:
    f.write(text)
