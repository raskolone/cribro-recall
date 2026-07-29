const fs = require('fs');
let content = fs.readFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', 'utf8');

// 1. Remove the big banner block
const bannerStart = `<AnimatePresence>
              {user?.hasNewVocabulary && !isBannerDismissed && (`;
const bannerEndRegex = /<\/AnimatePresence>/g;

// Find the first AnimatePresence after step === 'setup'
const setupMatch = content.indexOf("{step === 'setup' && (");
const firstAnimatePresence = content.indexOf("<AnimatePresence>", setupMatch);
const firstAnimatePresenceEnd = content.indexOf("</AnimatePresence>", firstAnimatePresence) + "</AnimatePresence>".length;

if (firstAnimatePresence !== -1 && content.substring(firstAnimatePresence, firstAnimatePresenceEnd).includes('hasNewVocabulary')) {
    content = content.substring(0, firstAnimatePresence) + content.substring(firstAnimatePresenceEnd);
    console.log("Removed big banner");
} else {
    console.log("Big banner not found or already removed");
}

const headingPl = "{language === 'pl' ? 'Czas na trening' : 'Time for training'}";
const newHeadingContent = `{language === 'pl' ? 'Czas na trening' : 'Time for training'}
                        {user?.hasNewVocabulary && !isBannerDismissed && (
                          <span 
                            onClick={() => {
                              setSelectedSetId('lessons');
                              if (vocabularySets.length > 0 && selectedLessonIds.length === 0) {
                                setSelectedLessonIds([vocabularySets[0].id]);
                              }
                              setIsBannerDismissed(true);
                              if (user?.id) {
                                updateDoc(doc(db, 'users', user.id), { hasNewVocabulary: false }).catch(console.error);
                              }
                            }}
                            className="ml-3 text-xs md:text-sm px-3 py-1 bg-primary/20 text-primary border border-primary/40 rounded-full animate-pulse cursor-pointer hover:bg-primary/30 transition-colors whitespace-nowrap font-semibold"
                          >
                            {language === 'pl' ? 'Nowe słówka' : 'New vocab'}
                          </span>
                        )}
                        {user?.hasNewLesson && (
                          <span className="ml-2 text-xs md:text-sm px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full animate-pulse cursor-default whitespace-nowrap font-semibold">
                            {language === 'pl' ? 'Nowa lekcja' : 'New lesson'}
                          </span>
                        )}`;

// Replace in mobile
const mobileHeading = `<h2 className="text-2xl font-bold text-white">${headingPl}</h2>`;
const newMobileHeading = `<h2 className="text-2xl font-bold text-white flex items-center flex-wrap gap-y-2">
                        ${newHeadingContent}
                      </h2>`;

content = content.replace(mobileHeading, newMobileHeading);

// Replace in desktop
const desktopHeading = `<h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        ${headingPl}
                      </h2>`;
const newDesktopHeading = `<h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center flex-wrap gap-y-2">
                        ${newHeadingContent}
                      </h2>`;

content = content.replace(desktopHeading, newDesktopHeading);

fs.writeFileSync('components/dashboard/AIExerciseGeneratorScreen.tsx', content);
console.log("Patched headings");
