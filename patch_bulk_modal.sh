sed -i '1425i \
      {showBulkAddModal && (\
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">\
          <Card className="w-full max-w-2xl bg-base-300 border-white/10">\
            <div className="p-6 space-y-4">\
              <div className="flex justify-between items-center">\
                <h2 className="text-xl font-bold text-white flex items-center gap-2">\
                  <FileText className="text-primary" /> Dodaj własne zdania hurtowo\
                </h2>\
                <button onClick={() => setShowBulkAddModal(false)} className="text-content-muted hover:text-white transition-colors p-1">\
                  <X size={20} />\
                </button>\
              </div>\
              <p className="text-sm text-content-muted">\
                Wklej listę zdań (po polsku lub po polsku i angielsku). AI przeanalizuje tekst i automatycznie podzieli go na osobne zadania do tłumaczenia.\
              </p>\
              <textarea\
                rows={10}\
                value={bulkText}\
                onChange={(e) => setBulkText(e.target.value)}\
                placeholder="Np.\\n1. Chcę kupić nowy samochód.\\n2. I want to buy a new car.\\n..."\
                className="w-full px-4 py-3 bg-base-100 text-white border border-white/10 rounded-xl focus:border-primary focus:outline-none text-sm resize-y"\
              />\
              <div className="flex justify-end gap-3 pt-2">\
                <Button variant="secondary" onClick={() => setShowBulkAddModal(false)}>\
                  Anuluj\
                </Button>\
                <Button onClick={handleBulkProcess} isLoading={isBulkProcessing} className="flex items-center gap-2">\
                  <Sparkles size={18} /> Przetwórz z AI\
                </Button>\
              </div>\
            </div>\
          </Card>\
        </div>\
      )}\
' components/dashboard/HomeworkScreen.tsx
