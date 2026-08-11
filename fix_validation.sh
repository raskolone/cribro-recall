sed -i '221,225c\
      const hasEmpty = errorCorrectionItems.some(i => !i.textWithBlanks.trim() || Object.keys(i.blanks).length === 0);\
      if (hasEmpty) {\
        alert("Uzupełnij tekst z lukami i definicje luk dla wszystkich elementów.");\
        return;\
      }' components/dashboard/HomeworkScreen.tsx
