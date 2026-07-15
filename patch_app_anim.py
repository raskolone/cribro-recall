with open('App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("import React, { useState } from 'react';", "import React, { useState } from 'react';\nimport { motion, AnimatePresence } from 'motion/react';")

old_render = """        {user ? (
          <VocabularyProvider>
            <SettingsProvider>
            <FlashcardProvider>
              <Dashboard />
            </FlashcardProvider>
            </SettingsProvider>
          </VocabularyProvider>
        ) : showAuth ? (
          <AuthScreen onBack={() => setShowAuth(false)} />
        ) : (
          <LandingPage onLoginClick={() => setShowAuth(true)} />
        )}"""

new_render = """        <AnimatePresence mode="wait">
          {user ? (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="w-full flex-1 flex flex-col">
              <VocabularyProvider>
                <SettingsProvider>
                <FlashcardProvider>
                  <Dashboard />
                </FlashcardProvider>
                </SettingsProvider>
              </VocabularyProvider>
            </motion.div>
          ) : showAuth ? (
            <motion.div key="auth" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4 }} className="w-full flex-1 flex flex-col">
              <AuthScreen onBack={() => setShowAuth(false)} />
            </motion.div>
          ) : (
            <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} className="w-full flex-1 flex flex-col">
              <LandingPage onLoginClick={() => setShowAuth(true)} />
            </motion.div>
          )}
        </AnimatePresence>"""

code = code.replace(old_render, new_render)

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Patched App.tsx")
