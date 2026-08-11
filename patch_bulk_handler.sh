sed -i '237i \
  const handleBulkProcess = async () => {\
    if (!bulkText.trim()) return;\
    setIsBulkProcessing(true);\
    try {\
      const newItems = await processBulkSentences(bulkText);\
      if (newItems && newItems.length > 0) {\
        setTranslationItems([...translationItems, ...newItems]);\
        setShowBulkAddModal(false);\
        setBulkText("");\
      } else {\
        alert("Nie udało się wygenerować zadań. Sprawdź format tekstu.");\
      }\
    } catch (e: any) {\
      alert("Wystąpił błąd podczas przetwarzania zdań.");\
    } finally {\
      setIsBulkProcessing(false);\
    }\
  };\
' components/dashboard/HomeworkScreen.tsx
