const fs = require('fs');
const path = 'components/dashboard/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes("from 'motion/react'")) {
  const importRegex = /import React, \{ useState, useEffect, useRef \} from 'react';/;
  if (content.match(importRegex)) {
    content = content.replace(importRegex, "import React, { useState, useEffect, useRef } from 'react';\nimport { motion, AnimatePresence } from 'motion/react';");
    fs.writeFileSync(path, content);
    console.log("Patched imports");
  } else {
    console.log("Could not find import regex");
  }
} else {
  console.log("Imports already present");
}
