with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_num_anim = """  useEffect(() => {
    if (numSentencesRef.current) {
      gsap.fromTo(numSentencesRef.current, 
        { scale: 1.6, color: '#ffffff' }, 
        { scale: 1, color: '#72f0b4', duration: 0.5, ease: 'back.out(2)' }
      );
    }
  }, [numSentences]);"""

new_num_anim = """  useEffect(() => {
    if (numSentencesRef.current) {
      const targetScale = 0.7 + (numSentences / 50) * 0.8;
      gsap.fromTo(numSentencesRef.current, 
        { scale: targetScale * 1.5, color: '#ffffff' }, 
        { scale: targetScale, color: '#72f0b4', duration: 0.5, ease: 'back.out(2)' }
      );
    }
  }, [numSentences]);"""

old_time_anim = """  useEffect(() => {
    if (timeLimitRef.current) {
      gsap.fromTo(timeLimitRef.current, 
        { scale: 1.6, color: '#ffffff' }, 
        { scale: 1, color: '#72f0b4', duration: 0.5, ease: 'back.out(2)' }
      );
    }
  }, [timeLimit]);"""

new_time_anim = """  useEffect(() => {
    if (timeLimitRef.current) {
      const targetScale = 0.7 + (timeLimit / 15) * 0.8;
      gsap.fromTo(timeLimitRef.current, 
        { scale: targetScale * 1.5, color: '#ffffff' }, 
        { scale: targetScale, color: '#72f0b4', duration: 0.5, ease: 'back.out(2)' }
      );
    }
  }, [timeLimit]);"""

code = code.replace(old_num_anim, new_num_anim)
code = code.replace(old_time_anim, new_time_anim)

with open('components/dashboard/AIExerciseGeneratorScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
