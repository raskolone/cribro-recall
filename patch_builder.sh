sed -i '991,1052c\
                      <div className="space-y-3">\
                        <div>\
                          <label className="block text-[11px] font-semibold text-amber-400 mb-1">Tekst z lukami (użyj [BLANK_1] itd.)</label>\
                          <textarea\
                            rows={3}\
                            value={item.textWithBlanks}\
                            onChange={(e) => {\
                              const updated = [...errorCorrectionItems];\
                              updated[idx].textWithBlanks = e.target.value;\
                              setErrorCorrectionItems(updated);\
                            }}\
                            placeholder="This is a [BLANK_1]..."\
                            className="w-full px-3 py-1.5 bg-base-100 text-white border border-amber-500/30 rounded-lg text-xs"\
                          />\
                        </div>\
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">\
                          <div>\
                            <label className="block text-[11px] font-semibold text-emerald-400 mb-1">Odpowiedzi (JSON format)</label>\
                            <textarea\
                              rows={3}\
                              defaultValue={JSON.stringify(item.blanks, null, 2)}\
                              onBlur={(e) => {\
                                const updated = [...errorCorrectionItems];\
                                try {\
                                  updated[idx].blanks = JSON.parse(e.target.value);\
                                  setErrorCorrectionItems(updated);\
                                } catch(err) {\
                                  // ignore invalid json\
                                }\
                              }}\
                              placeholder="{ \"BLANK_1\": \"word\" }"\
                              className="w-full px-3 py-1.5 bg-base-100 text-white border border-emerald-500/30 rounded-lg text-xs font-mono"\
                            />\
                          </div>\
                          <div>\
                            <label className="block text-[11px] font-semibold text-content-muted mb-1">Dostępne słowa (po przecinku)</label>\
                            <textarea\
                              rows={3}\
                              value={(item.availableWords || []).join(", ")}\
                              onChange={(e) => {\
                                const updated = [...errorCorrectionItems];\
                                updated[idx].availableWords = e.target.value.split(",").map(s => s.trim()).filter(Boolean);\
                                setErrorCorrectionItems(updated);\
                              }}\
                              placeholder="word1, word2, word3"\
                              className="w-full px-3 py-1.5 bg-base-100 text-white border border-white/10 rounded-lg text-xs"\
                            />\
                          </div>\
                        </div>\
                      </div>' components/dashboard/HomeworkScreen.tsx
