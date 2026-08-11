sed -i '171,177c\
        );\
        if (result && result.textWithBlanks) {\
          setErrorCorrectionItems([result]);\
        } else {\
          setGenError("Nie udało się wygenerować zadań z lukami.");\
        }' components/dashboard/HomeworkScreen.tsx

sed -i '194,197c\
      setErrorCorrectionItems([\
        ...errorCorrectionItems,\
        { textWithBlanks: "", blanks: {}, availableWords: [] }\
      ]);' components/dashboard/HomeworkScreen.tsx
