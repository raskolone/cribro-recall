import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { BugReport } from '../../types';
import { Bug, CheckCircle, Clock, Trash2, ArrowLeft } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import i18n from "i18next";

interface AdminDebuggingScreenProps {
  onBack: () => void;
}

const AdminDebuggingScreen: React.FC<AdminDebuggingScreenProps> = ({ onBack }) => {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'bug_reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: BugReport[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() } as BugReport);
      });
      setReports(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching bug reports:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateStatus = async (id: string, status: BugReport['status']) => {
    try {
      await updateDoc(doc(db, 'bug_reports', id), { status });
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const deleteReport = async (id: string) => {
    if (!window.confirm("Czy na pewno chcesz usunąć to zgłoszenie?")) return;
    try {
      await deleteDoc(doc(db, 'bug_reports', id));
      if (selectedReport?.id === id) {
        setSelectedReport(null);
      }
    } catch (error) {
      console.error("Failed to delete report", error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Brak daty';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('pl-PL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bug className="text-red-500" />
          
                            {i18n.t("Zgłoszenia problemów")}
                          </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lista zgłoszeń */}
        <div className="md:col-span-1 space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
          {reports.length === 0 ? (
            <div className="text-center p-8 bg-white/5 rounded-xl text-content-muted">
              
                                        {i18n.t("Brak zgłoszeń")}
                                      </div>
          ) : (
            reports.map(report => (
              <div 
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${
                  selectedReport?.id === report.id 
                    ? 'bg-primary/20 border-primary' 
                    : 'bg-black/20 border-white/10 hover:border-white/30'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    report.status === 'new' ? 'bg-red-500/20 text-red-500' : 
                    report.status === 'investigating' ? 'bg-yellow-500/20 text-yellow-500' : 
                    'bg-green-500/20 text-green-500'
                  }`}>
                    {report.status === 'new' ? 'Nowe' : report.status === 'investigating' ? 'W trakcie' : 'Rozwiązane'}
                  </span>
                  <span className="text-xs text-content-muted">{formatDate(report.createdAt)}</span>
                </div>
                <div className="font-medium truncate">{report.userName}</div>
                <div className="text-sm text-content-muted truncate mt-1">{report.description}</div>
              </div>
            ))
          )}
        </div>

        {/* Szczegóły zgłoszenia */}
        <div className="md:col-span-2">
          {selectedReport ? (
            <Card className="flex flex-col h-full bg-black/40 border border-white/10 p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">{i18n.t("Szczegóły zgłoszenia")}</h2>
                  <div className="text-sm text-content-muted">{i18n.t("Od:")} {selectedReport.userName} ({selectedReport.userEmail})</div>
                  <div className="text-sm text-content-muted">{i18n.t("Rola:")} {selectedReport.userRole}</div>
                  <div className="text-sm text-content-muted">{i18n.t("Ścieżka:")} {selectedReport.path || 'Brak'}</div>
                  <div className="text-sm text-content-muted mt-1">{i18n.t("Data:")} {formatDate(selectedReport.createdAt)}</div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => updateStatus(selectedReport.id!, 'investigating')}
                    disabled={selectedReport.status === 'investigating'}
                    className={`p-2 rounded-lg transition-colors ${selectedReport.status === 'investigating' ? 'bg-yellow-500 text-black' : 'bg-white/10 hover:bg-yellow-500/20 text-yellow-500'}`}
                    title={i18n.t("Oznacz jako W trakcie")}
                  >
                    <Clock size={20} />
                  </button>
                  <button 
                    onClick={() => updateStatus(selectedReport.id!, 'resolved')}
                    disabled={selectedReport.status === 'resolved'}
                    className={`p-2 rounded-lg transition-colors ${selectedReport.status === 'resolved' ? 'bg-green-500 text-black' : 'bg-white/10 hover:bg-green-500/20 text-green-500'}`}
                    title={i18n.t("Oznacz jako Rozwiązane")}
                  >
                    <CheckCircle size={20} />
                  </button>
                  <button 
                    onClick={() => deleteReport(selectedReport.id!)}
                    className="p-2 bg-white/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors ml-2"
                    title={i18n.t("Usuń zgłoszenie")}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                <div>
                  <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider mb-2">{i18n.t("Opis użytkownika")}</h3>
                  <div className="bg-white/5 p-4 rounded-xl text-sm whitespace-pre-wrap font-mono">
                    {selectedReport.description}
                  </div>
                </div>

                {selectedReport.errorContext && (
                  <div>
                    <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-2">{i18n.t("Kontekst błędu z kodu")}</h3>
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-xs whitespace-pre-wrap font-mono overflow-x-auto text-red-300">
                      {selectedReport.errorContext}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-full bg-black/20 border border-white/5 rounded-2xl text-content-muted">
              
                                            {i18n.t("Wybierz zgłoszenie z listy, aby zobaczyć szczegóły")}
                                          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDebuggingScreen;
