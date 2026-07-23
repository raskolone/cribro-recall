import re

with open('components/admin/AdminPanel.tsx', 'r') as f:
    text = f.read()

# Currently, we have:
# {!selectedUser && activeTab !== 'tests' ? (
# Let's revert it back to {!selectedUser ? ( if it was changed
text = text.replace("{!selectedUser && activeTab !== 'tests' ? (", "{!selectedUser ? (")

# Then we find:
#      ) : (
#        <div className="space-y-6">
#          {!selectedUser ? (

# and change it to:
#      ) : activeTab === 'tests' ? (
#         <div className="space-y-6">
#           <div className="flex items-center gap-4 mb-6">
#             <button onClick={() => { setActiveTab(null); if (onViewChange) onViewChange('admin'); }} className="flex items-center gap-2 text-content-muted hover:text-white transition-colors bg-base-200/50 px-4 py-2 rounded-xl border border-white/5 hover:border-primary/50">
#               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>Wróć do panelu głównego
#             </button>
#           </div>
#           <AdminTestGenerator user={selectedUser} users={users} />
#         </div>
#      ) : (
#        <div className="space-y-6">
#          {!selectedUser ? (

old_block = """      ) : (
        <div className="space-y-6">
          {!selectedUser ? ("""

new_block = """      ) : activeTab === 'tests' ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => { setActiveTab(null); if (onViewChange) onViewChange('admin'); }} className="flex items-center gap-2 text-content-muted hover:text-white transition-colors bg-base-200/50 px-4 py-2 rounded-xl border border-white/5 hover:border-primary/50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
              Wróć do panelu głównego
            </button>
          </div>
          <AdminTestGenerator user={selectedUser} users={users} />
        </div>
      ) : (
        <div className="space-y-6">
          {!selectedUser ? ("""

text = text.replace(old_block, new_block)

# And remove the redundant rendering of AdminTestGenerator at the bottom:
#          {activeTab === 'tests' && (
#            <AdminTestGenerator user={selectedUser} users={users} />
#          )}
# OR
#          {activeTab === 'tests' && (
#            <AdminTestGenerator user={selectedUser} />
#          )}

text = re.sub(r'\{\s*activeTab === \'tests\' && \(\s*<AdminTestGenerator [^>]+>\s*\)\s*\}', '', text)

with open('components/admin/AdminPanel.tsx', 'w') as f:
    f.write(text)
