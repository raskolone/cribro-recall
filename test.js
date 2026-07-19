const semanticChunking = (sentence) => {
      const words = sentence.trim().split(/\s+/);
      const chunks = [];
      let currentChunk = [];
      const breakBefore = new Set([
        'the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'these', 'those',
        'in', 'on', 'at', 'to', 'for', 'with', 'about', 'by', 'from', 'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out', 'against', 'during', 'without', 'before', 'under', 'around', 'among',
        'and', 'but', 'or', 'so', 'because', 'although', 'if', 'when', 'while', 'which', 'who', 'where',
        'i', 'you', 'he', 'she', 'it', 'we', 'they',
        'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'shall', 'should', 'will', 'would', 'may', 'might', 'must'
      ]);
      const dontBreakAfter = new Set([
        'the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'these', 'those',
        'of', 'very', 'not', 'no', 'to', 'in', 'on', 'at'
      ]);
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
        const nextWord = i < words.length - 1 ? words[i + 1] : null;
        const cleanNextWord = nextWord ? nextWord.replace(/[^a-zA-Z]/g, '').toLowerCase() : '';
        currentChunk.push(word);
        const hasPunctuation = /[.,!?;:]$/.test(word);
        const shouldBreakBeforeNext = breakBefore.has(cleanNextWord);
        const shouldNotBreakAfterCurrent = dontBreakAfter.has(cleanWord);
        let shouldBreak = false;
        if (hasPunctuation) {
          shouldBreak = true;
        } else if (currentChunk.length >= 2 && shouldBreakBeforeNext && !shouldNotBreakAfterCurrent) {
          shouldBreak = true;
        } else if (currentChunk.length >= 4) {
          if (!shouldNotBreakAfterCurrent) {
             shouldBreak = true;
          } else if (currentChunk.length >= 5) {
             shouldBreak = true;
          }
        }
        if (cleanNextWord === 'of' && currentChunk.length >= 2) {
           shouldBreak = false;
        } else if (cleanWord === 'of' && currentChunk.length >= 2) {
           shouldBreak = true;
        }
        if (shouldBreak) {
          if (i !== words.length - 1) {
            chunks.push(currentChunk.join(' '));
            currentChunk = [];
          }
        }
      }
      if (currentChunk.length > 0) {
        if (currentChunk.length <= 1 && chunks.length > 0) {
          chunks[chunks.length - 1] += ' ' + currentChunk[0];
        } else {
          chunks.push(currentChunk.join(' '));
        }
      }
      return chunks;
    };
console.log(semanticChunking("The quick brown fox jumps over the lazy dog."));
