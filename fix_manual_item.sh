sed -i '190,201c\
      setTranslationItems([\
        ...translationItems,\
        { polishSentence: "", englishTranslation: "", hint: "" }\
      ]);\
    } else {\
      setErrorCorrectionItems([\
        ...errorCorrectionItems,\
        { textWithBlanks: "", blanks: {}, availableWords: [] }\
      ]);\
    }\
  };\
' components/dashboard/HomeworkScreen.tsx
