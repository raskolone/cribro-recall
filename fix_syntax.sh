sed -i '177c\
        }\
      }' components/dashboard/HomeworkScreen.tsx

sed -i '194,198c\
      setErrorCorrectionItems([\
        ...errorCorrectionItems,\
        { textWithBlanks: "", blanks: {}, availableWords: [] }\
      ]);\
    }' components/dashboard/HomeworkScreen.tsx
