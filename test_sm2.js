function calculateSM2(quality, repetitions, interval, easeFactor) {
  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }
  
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;
  
  return { repetitions, interval, easeFactor };
}
console.log(calculateSM2(4, 0, 0, 2.5)); // Correct, first time
console.log(calculateSM2(1, 1, 1, 2.5)); // Incorrect
