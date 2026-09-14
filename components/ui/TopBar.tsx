import React, { useEffect, useRef, useState } from 'react';
import { Bug, HelpCircle, LogOut, Settings as SettingsIcon, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import BrandLogo from './BrandLogo';
import ThemeToggle from './ThemeToggle';

/**
 * Pasek górny — jedyna stała rama aplikacji po zdjęciu menu bocznego.
 *
 * ══ DLACZEGO MENU BOCZNE ZNIKŁO ══
 *
 * Niosło dwie rzeczy naraz: nawigację do modułów i ustawienia konta. Pierwszą
 * przejęły kafelki w panelach — są większe, mieszczą się na telefonie bez
 * wysuwania szuflady i stoją tam, gdzie się pracuje. Druga nigdy nie
 * potrzebowała stałej kolumny: język, motyw, pomoc i wylogowanie to rzeczy,
 * po które sięga się raz na kilka dni.
 *
 * Zostawienie menu „na wszelki wypadek" znaczyłoby dwie drogi do każdego
 * modułu i 280 px szerokości zajęte na stałe przez wejścia, których się nie
 * używa.
 *
 * ══ CO JEST NA PASKU ══
 *
 * Trzy rzeczy i nic więcej: znak marki (wraca do panelu), zdanie o tym, co
 * czeka, i koło zębate. Pasek ma mówić, czy coś się wydarzyło — nie być
 * drugim spisem narzędzi.
 *
 * ══ PANEL ZARZĄDZANIA POD KOŁEM ZĘBATYM ══
 *
 * Jedno miejsce na wszystko, co dotyczy konta i wyglądu, zamiast kafelka
 * „Ustawienia" wśród narzędzi do prowadzenia lekcji. Ustawienia nie są
 * narzędziem lektora — są ustawieniami aplikacji i mają leżeć tam, gdzie
 * leżą w każdym innym programie.
 */

export interface TopBarNotice {
  /** Krótkie zdanie: co czeka. Bez tego pasek nie pokazuje niczego. */
  text: string;
  /** Dokąd prowadzi kliknięcie. */
  onClick?: () => void;
  /** Czy to sprawa pilna (czerwień) czy zwykłe powiadomienie (akcent). */
  tone?: 'accent' | 'danger';
}

interface TopBarProps {
  /** Powrót do panelu — znak marki i nic więcej. */
  onHome: () => void;
  onOpenSettings: () => void;
  onShowHelp: () => void;
  /** Diagnostyka — wyłącznie dla administratora. */
  onOpenDiagnostics?: () => void;
  /** Liczba nowych zgłoszeń błędów; > 0 świeci na czerwono. */
  newBugsCount?: number;
  /** Co czeka na użytkownika. Pusta tablica = pasek milczy. */
  notices?: TopBarNotice[];
}

const TopBar: React.FC<TopBarProps> = ({
  onHome,
  onOpenSettings,
  onShowHelp,
  onOpenDiagnostics,
  newBugsCount = 0,
  notices = [],
}) => {
  const { logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  /*
   * Zamknięcie kliknięciem obok i Escape'em. Bez tego panel zostaje otwarty
   * po przejściu do innego widoku i wisi nad treścią, której dotyczy klik.
   */
  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const t = (pl: string, en: string) => (language === 'pl' ? pl : en);
  const alert = newBugsCount > 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line-strong bg-base-200/90 backdrop-blur-md">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-5 h-14 flex items-center gap-3">
        {/* Logo jest drogą powrotną do panelu — i musi to po sobie pokazać.
            Bez `cursor-pointer` wyglądało dokładnie jak nagłówek do czytania,
            więc nikt go nie naciskał; lekkie rozjaśnienie przy najechaniu
            potwierdza, że to cel, a nie ozdoba. */}
        <button
          type="button"
          onClick={onHome}
          className="shrink-0 flex items-center cursor-pointer rounded-xl px-1 -mx-1 transition-opacity hover:opacity-80 active:opacity-70"
          title={t('Wróć do panelu', 'Back to the panel')}
          aria-label={t('Wróć do panelu', 'Back to the panel')}
        >
          <BrandLogo className="text-base" showTagline={false} />
        </button>

        {/* ── Pasek informacyjny ──

            Jedno zdanie naraz, nie lista. Trzy powiadomienia obok siebie
            w pasku o wysokości 56 px na telefonie znaczą trzy ucięte zdania;
            po szczegóły i tak wchodzi się w moduł. */}
        <div className="flex-1 min-w-0 flex items-center justify-center">
          {notices.length > 0 && (
            <button
              type="button"
              onClick={notices[0].onClick}
              className={`min-w-0 max-w-full flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] font-semibold truncate transition-colors ${
                notices[0].tone === 'danger'
                  ? 'border-danger/35 bg-danger/10 text-danger hover:bg-danger/15'
                  : 'border-primary/35 bg-primary/10 text-primary hover:bg-primary/15'
              }`}
            >
              {/* Kropka zamiast ikony: pasek ma sygnalizować, a nie ilustrować. */}
              <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
              <span className="truncate">{notices[0].text}</span>
              {notices.length > 1 && (
                <span className="shrink-0 font-mono opacity-70">+{notices.length - 1}</span>
              )}
            </button>
          )}
        </div>

        {/* ── Pomoc ──

            Stała, własny przycisk obok koła zębatego. Pod kołem zębatym była
            czwartą pozycją w rozwijanym panelu, czyli dokładnie tam, gdzie się
            jej nie szuka: przewodnik po aplikacji jest potrzebny wtedy, gdy
            ktoś NIE WIE, gdzie czegokolwiek szukać — a więc nie znajdzie go
            w menu, którego istnienia też jeszcze nie odkrył. */}
        <button
          type="button"
          onClick={onShowHelp}
          aria-label={t('Przewodnik po aplikacji', 'App guide')}
          title={t('Przewodnik po aplikacji', 'App guide')}
          className="shrink-0 w-10 h-10 rounded-xl border border-line-strong bg-base-100/60 text-content-muted hover:text-primary hover:border-primary/40 flex items-center justify-center transition-colors cursor-pointer"
        >
          <HelpCircle size={18} />
        </button>

        {/* ── Panel zarządzania ── */}
        <div className="relative shrink-0" ref={panelRef}>
          <button
            /* Samouczek wskazuje ten przycisk w kroku o ustawieniach i w kroku
               o pomocy — obie rzeczy leżą teraz tutaj, więc obie wskazują
               koło zębate zamiast dwóch pozycji w zniknionym menu. */
            id="tour-nav-settings"
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-label={t('Panel zarządzania', 'Management panel')}
            title={t('Ustawienia, język, pomoc, wylogowanie', 'Settings, language, help, logout')}
            className={`relative w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
              isOpen
                ? 'border-primary/50 bg-primary/12 text-primary'
                : 'border-line-strong bg-base-100/60 text-content-muted hover:text-text-hi hover:border-primary/40'
            }`}
          >
            <SettingsIcon size={18} />
            {/* Zgłoszony błąd musi być widoczny, zanim ktokolwiek otworzy panel. */}
            {alert && !isOpen && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-danger border-2 border-base-200" />
            )}
          </button>

          {isOpen && (
            <div className="absolute right-0 top-12 w-72 rounded-2xl border border-line-strong bg-base-200 shadow-[var(--shadow-lg)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-content-muted">
                  {t('Zarządzanie', 'Management')}
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-content-muted hover:text-text-hi"
                  aria-label={t('Zamknij', 'Close')}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-2 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-text-hi hover:bg-line-soft transition-colors"
                >
                  <SettingsIcon size={16} className="text-content-muted shrink-0" />
                  {t('Ustawienia', 'Settings')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onShowHelp();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-text-hi hover:bg-line-soft transition-colors"
                >
                  <HelpCircle size={16} className="text-content-muted shrink-0" />
                  {t('Pomoc', 'Help')}
                </button>

                {onOpenDiagnostics && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenDiagnostics();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      alert
                        ? 'text-danger hover:bg-danger/10'
                        : 'text-text-hi hover:bg-line-soft'
                    }`}
                  >
                    <Bug size={16} className={alert ? 'shrink-0' : 'text-content-muted shrink-0'} />
                    {t('Diagnostyka', 'Diagnostics')}
                    {alert && (
                      <span className="ml-auto text-[11px] font-mono font-bold">
                        {newBugsCount}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Wygląd i język — dwa ustawienia tego samego rodzaju: zmieniają,
                  jak aplikacja wygląda, a nie to, co się w niej robi. */}
              <div className="p-2 border-t border-line space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-content-muted">{t('Motyw', 'Theme')}</span>
                  <ThemeToggle />
                </div>

                <div className="flex items-center gap-1 p-1 rounded-xl bg-base-100/60 border border-line">
                  {(['pl', 'en'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLanguage(code)}
                      className={`flex-1 min-h-9 rounded-lg font-mono font-bold text-xs tracking-[0.1em] transition-colors ${
                        language === code
                          ? 'bg-primary/12 border border-primary/30 text-primary'
                          : 'border border-transparent text-content-muted hover:text-text-hi'
                      }`}
                    >
                      {code.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-content-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  <LogOut size={16} className="shrink-0" />
                  {t('Wyloguj się', 'Log out')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
