const fs = require('fs');
let code = fs.readFileSync('components/ui/FullScreenAILoading.tsx', 'utf-8');

code = code.replace(
  `import React, { useState, useEffect } from 'react';`,
  `import React, { useState, useEffect } from 'react';\nimport { createPortal } from 'react-dom';`
);

code = code.replace(
  `return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/40 backdrop-blur-lg">`,
  `const content = (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/40 backdrop-blur-lg">`
);

code = code.replace(
  `    </div>
  );
};`,
  `    </div>
  );

  return createPortal(content, document.body);
};`
);

fs.writeFileSync('components/ui/FullScreenAILoading.tsx', code);
console.log("Updated FullScreenAILoading.tsx");
