const fs = require('fs');
let file = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

file = file.replace(
  `          {/* Tangled chaotic string */}
          <path
            ref={tangledRef}
            d={tangledPath}
            stroke="#4ade80"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />`,
  `          <defs>
            <filter id="crayon" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="4" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          {/* Tangled chaotic string */}
          <path
            ref={tangledRef}
            d={tangledPath}
            stroke="#4ade80"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#crayon)"
          />`
);

file = file.replace(
  `          {/* String pulling away from tangle */}
          <path
            ref={stringPullRef}
            d="M 100,100 C 130,50 180,20 220,-20"
            stroke="#4ade80"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Organized perfect spiral */}
          <path
            ref={spiralRef}
            d={spiralPath}
            stroke="#4ade80"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />`,
  `          {/* String pulling away from tangle */}
          <path
            ref={stringPullRef}
            d="M 100,100 C 130,50 180,20 220,-20"
            stroke="#4ade80"
            strokeWidth="4"
            strokeLinecap="round"
            filter="url(#crayon)"
          />

          {/* Organized perfect spiral */}
          <path
            ref={spiralRef}
            d={spiralPath}
            stroke="#4ade80"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#crayon)"
          />`
);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', file);
