import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

import React, { useState } from 'react';
import Card from '../ui/Card';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { useVocabulary } from '../../context/VocabularyContext';
import { useSettings } from '../../context/SettingsContext';
import { useLanguage } from '../../context/LanguageContext';
import { FREQUENCIES } from '../../constants';
import { RevisionFrequency } from '../../types';
import { LogOut, User } from 'lucide-react';

const SettingsScreen: React.FC = () => {
    const { frequency, setFrequency, deleteAllWords, words } = useVocabulary();
    const { showLearningProgressChart, setShowLearningProgressChart } = useSettings();
    const { language } = useLanguage();
    const { linkGoogleAccount, user, logout } = useAuth();
    const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
    const [linkError, setLinkError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowDeleteModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const executeDeleteAll = async () => {
        setIsDeleting(true);
        try {
            await deleteAllWords();
        } catch (error) {
            console.error('Failed to delete words:', error);
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const handleDeleteClick = () => {
        if (words.length > 0) {
            setShowDeleteModal(true);
        }
    };

    return (
        <div className="space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <Card>
                    <h2 className="text-xl font-bold mb-4">{language === 'pl' ? 'Konto i Integracje' : 'Account & Integrations'}</h2>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-content-muted mb-2">
                                {language === 'pl' ? 'Powiąż swoje konto z Google, aby móc logować się za jego pomocą i importować słówka z Google Drive i Google Docs.' : 'Link your account with Google to log in via Google and import words from Google Drive and Google Docs.'}
                            </p>
                            {auth.currentUser?.providerData?.some((p: any) => p.providerId === 'google.com') ? (
                                <div className="text-green-500 font-bold text-sm">✓ {language === 'pl' ? 'Konto połączone z Google' : 'Account linked to Google'}</div>
                            ) : (
                                <Button 
                                    onClick={async () => {
                                        setIsLinkingGoogle(true);
                                        setLinkError(null);
                                        try {
                                            await linkGoogleAccount();
                                        } catch (err: any) {
                                            setLinkError(err.message || 'Error linking account');
                                        } finally {
                                            setIsLinkingGoogle(false);
                                        }
                                    }}
                                    isLoading={isLinkingGoogle}
                                    variant="secondary"
                                >
                                    {language === 'pl' ? 'Połącz z Google' : 'Link with Google'}
                                </Button>
                            )}
                            {linkError && <p className="text-red-500 text-sm mt-2">{linkError}</p>}
                        </div>
                    </div>
                </Card>

                <Card>
                    <h2 className="text-xl font-bold mb-4">Revision Program</h2>
                    <div className="space-y-4">
                        <Select
                            id="frequency"
                            label="Revision Frequency"
                            options={FREQUENCIES}
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as RevisionFrequency)}
                        />
                        <p className="text-sm text-content-muted">
                            This setting controls how often you are prompted to revise words you have marked as difficult.
                        </p>
                    </div>
                </Card>

                <Card className="border-red-500/30 bg-red-500/5">
                    <h2 className="text-xl font-bold mb-4 text-red-500">Danger Zone</h2>
                    <div className="space-y-4">
                        <p className="text-sm text-content-muted">
                            Permanently delete all generated words from your account. This action cannot be undone.
                        </p>
                        <Button 
                            variant="danger" 
                            onClick={handleDeleteClick} 
                            isLoading={isDeleting}
                            disabled={words.length === 0}
                            className="w-full sm:w-auto"
                        >
                            Clear All Words ({words.length})
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-base-100/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md shadow-2xl border-primary/20">
                        <h3 className="text-xl font-bold mb-4 text-red-500">Confirm Deletion</h3>
                        <p className="mb-6 opacity-80">
                            Are you sure you want to delete all {words.length} generated words? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button onClick={() => setShowDeleteModal(false)} variant="secondary">
                                Cancel
                            </Button>
                            <Button onClick={executeDeleteAll} variant="danger" isLoading={isDeleting}>
                                Yes, Delete All
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default SettingsScreen;
