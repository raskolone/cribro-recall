const fs = require('fs');
let code = fs.readFileSync('components/settings/SettingsScreen.tsx', 'utf-8');

const target = `import { useLanguage } from '../../context/LanguageContext';
import { FREQUENCIES } from '../../constants';
import { RevisionFrequency } from '../../types';

const SettingsScreen: React.FC = () => {`;

const replacement = `import { useLanguage } from '../../context/LanguageContext';
import { FREQUENCIES } from '../../constants';
import { RevisionFrequency } from '../../types';
import { LogOut, User } from 'lucide-react';

const SettingsScreen: React.FC = () => {`;

code = code.replace(target, replacement);

const target2 = `const SettingsScreen: React.FC = () => {
    const { frequency, setFrequency, deleteAllWords, words } = useVocabulary();
    const { showLearningProgressChart, setShowLearningProgressChart } = useSettings();
    const { language } = useLanguage();
    const { linkGoogleAccount, user } = useAuth();`;

const replacement2 = `const SettingsScreen: React.FC = () => {
    const { frequency, setFrequency, deleteAllWords, words } = useVocabulary();
    const { showLearningProgressChart, setShowLearningProgressChart } = useSettings();
    const { language } = useLanguage();
    const { linkGoogleAccount, user, logout } = useAuth();`;

code = code.replace(target2, replacement2);

const target3 = `        <div className="space-y-6">
            <h1 className="text-2xl font-extrabold tracking-tight mb-6">{language === 'pl' ? 'Ustawienia' : 'Settings'}</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">`;

const replacement3 = `        <div className="space-y-6">
            <h1 className="text-2xl font-extrabold tracking-tight mb-6">{language === 'pl' ? 'Ustawienia' : 'Settings'}</h1>
            
            <Card className="mb-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-16 h-16 rounded-full border-2 border-primary/20 bg-base-300 overflow-hidden">
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt={user.username || 'User'} className="w-full h-full object-cover" />
                            ) : (
                                <span className="font-bold text-primary font-mono text-2xl">{user?.username?.[0]?.toUpperCase() || 'U'}</span>
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{user?.username}</h2>
                            <p className="text-sm text-content-muted">{user?.email}</p>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-base-300 text-content-muted">Role: {user?.role}</span>
                                {user?.level && <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary">Level: {user.level}</span>}
                            </div>
                        </div>
                    </div>
                    <Button variant="secondary" onClick={() => logout()} className="flex items-center gap-2">
                        <LogOut size={16} />
                        {language === 'pl' ? 'Wyloguj się' : 'Logout'}
                    </Button>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">`;

code = code.replace(target3, replacement3);

fs.writeFileSync('components/settings/SettingsScreen.tsx', code);
