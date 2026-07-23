import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { StudentTest } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';
import TakeTestScreen from './TakeTestScreen';
import i18n from "i18next";

interface StudentTestsScreenProps {
  onBack: () => void;
}

const StudentTestsScreen: React.FC<StudentTestsScreenProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeTest, setActiveTest] = useState<StudentTest | null>(null);

  useEffect(() => {
    fetchTests();
  }, [user]);

  const fetchTests = async () => {
    if (!user?.id) return;
    try {
      const q = query(collection(db, `users/${user.id}/tests`), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setTests(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentTest)));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (activeTest) {
    return <TakeTestScreen test={activeTest} onBack={() => { setActiveTest(null); fetchTests(); }} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{i18n.t("Twoje Testy")}</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
      ) : (
        <div className="space-y-4">
          {tests.map(test => (
            <Card key={test.id} className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-xl">{test.title}</h3>
                <p className="text-sm text-content-muted mt-1">{test.scope}</p>
                <div className="flex gap-4 mt-3 text-xs font-mono">
                  <span className="text-orange-300">{i18n.t("Do:")} {test.dueDate}</span>
                  <span className="text-blue-300">{i18n.t("Pytań:")} {test.questions.length}</span>
                </div>
              </div>
              
              <div className="flex-shrink-0 text-center">
                {(test.status === 'pending' || (test.attemptsLimit && (test.attemptsUsed || 0) < test.attemptsLimit)) ? (
                  <div className="flex flex-col items-center gap-2">
                    <Button onClick={() => setActiveTest(test)} className="bg-primary text-black hover:bg-primary/90 font-bold w-full md:w-auto">
                      {test.status === 'pending' ? 'Rozpocznij Test' : 'Spróbuj ponownie'}
                    </Button>
                    {test.attemptsLimit && test.attemptsLimit < 999 && (
                      <span className="text-xs text-content-muted">
                        
                                                              {i18n.t("Wykorzystane podejścia:")} {test.attemptsUsed || 0}/{test.attemptsLimit}
                      </span>
                    )}
                    {test.status !== 'pending' && test.score !== undefined && (
                      <span className="text-xs text-primary">{i18n.t("Ostatni wynik:")} {test.score}/{test.maxScore}  {i18n.t("pkt")}</span>
                    )}
                  </div>
                ) : (
                  <div className="bg-base-300/50 px-4 py-2 rounded-lg border border-white/5">
                    <div className="font-bold text-sm mb-1 text-primary">{i18n.t("Zakończony")}</div>
                    {test.score !== undefined && (
                      <div className="text-xl font-bold">{test.score}/{test.maxScore} <span className="text-xs text-content-muted">{i18n.t("pkt")}</span></div>
                    )}
                    {test.attemptsLimit && test.attemptsLimit < 999 && (
                      <span className="text-xs text-content-muted mt-1 block">
                        
                                                                  {i18n.t("Wykorzystane podejścia:")} {test.attemptsUsed || 0}/{test.attemptsLimit}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
          
          {tests.length === 0 && (
            <div className="text-center py-12 text-content-muted">
              
                                            {i18n.t("Nie masz aktualnie żadnych przypisanych testów.")}
                                          </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentTestsScreen;
