sed -i '944,946c\
              <div className="flex gap-2">\
                {homeworkType === "translation" && (\
                  <Button size="sm" variant="secondary" onClick={() => setShowBulkAddModal(true)} className="flex items-center gap-1 text-xs">\
                    <FileText size={14} /> Wklej własne zdania\
                  </Button>\
                )}\
                <Button size="sm" variant="secondary" onClick={handleAddManualItem} className="flex items-center gap-1 text-xs">\
                  <Plus size={14} /> Dodaj pojedynczo\
                </Button>\
              </div>\
' components/dashboard/HomeworkScreen.tsx
