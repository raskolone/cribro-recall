import React, { useState, useEffect } from 'react';
import { X, Link2, Loader2, Globe, LayoutList, LayoutTemplate, GalleryHorizontal } from 'lucide-react';
import { auth } from '../../firebase';
import { useEscapeModal } from '../../hooks/useEscapeModal';

export type LinkCardSize = 'compact' | 'medium' | 'large';

export interface OgPreviewData {
  url: string;
  domain: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string;
}

interface InsertLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmInsert: (data: OgPreviewData, size: LinkCardSize, customTitle?: string) => void;
}

const SIZE_OPTIONS: { id: LinkCardSize; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'compact', label: 'Kompaktowy', icon: <LayoutList size={14} />, hint: 'Pasek z ikoną, tytułem i domeną' },
  { id: 'medium', label: 'Karta średnia', icon: <LayoutTemplate size={14} />, hint: 'Tytuł, opis i miniaturka' },
  { id: 'large', label: 'Karta duża', icon: <GalleryHorizontal size={14} />, hint: 'Duży baner z podglądem' },
];

export const InsertLinkModal: React.FC<InsertLinkModalProps> = ({ isOpen, onClose, onConfirmInsert }) => {
  useEscapeModal(isOpen, onClose);

  const [url, setUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [size, setSize] = useState<LinkCardSize>('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OgPreviewData | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setCustomTitle('');
      setSize('medium');
      setIsLoading(false);
      setError(null);
      setPreview(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const domainFallback = (rawUrl: string): string => {
    try {
      return new URL(rawUrl).hostname.replace(/^www\./, '');
    } catch {
      return rawUrl;
    }
  };

  const handleFetchPreview = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    setIsLoading(true);
    setError(null);
    setPreview(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/og-preview?url=${encodeURIComponent(normalized)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      } else {
        throw new Error('og-preview failed');
      }
    } catch (err) {
      // Fallback: elegancka karta z samą nazwą domeny, gdy pobranie OG się nie uda
      const domain = domainFallback(normalized);
      setPreview({
        url: normalized,
        domain,
        title: domain,
        description: '',
        image: null,
        favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
      });
      setError('Nie udało się pobrać podglądu strony — wstawiona zostanie uproszczona karta.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsert = () => {
    if (!preview) return;
    onConfirmInsert(preview, size, customTitle.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="insert-link-title"
        className="relative w-full max-w-lg bg-base-200 border border-primary/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line-strong bg-base-300/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Link2 size={18} />
            </div>
            <h3 id="insert-link-title" className="text-sm sm:text-base font-black text-text-hi">
              Wstaw link z kartą podglądu
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="p-2 rounded-xl text-content-muted hover:text-text-hi hover:bg-line-soft transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1">
              Adres URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFetchPreview();
                  }
                }}
                placeholder="https://example.com/artykul"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-base-100 border border-line-strong text-xs sm:text-sm text-text-hi focus:border-primary focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleFetchPreview}
                disabled={!url.trim() || isLoading}
                className="px-3.5 py-2.5 rounded-xl bg-primary text-accent-ink font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 cursor-pointer hover:brightness-110 transition-all shrink-0"
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                <span>Pobierz</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1">
              Własny tytuł (opcjonalnie)
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Nadpisz pobrany tytuł..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-base-100 border border-line-strong text-xs sm:text-sm text-text-hi focus:border-primary focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-[11px] text-amber-500 dark:text-amber-300 font-medium leading-relaxed">
              {error}
            </p>
          )}

          {preview && (
            <>
              <div>
                <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5">
                  Rozmiar karty
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSize(opt.id)}
                      title={opt.hint}
                      className={`p-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        size === opt.id
                          ? 'bg-primary text-accent-ink border-primary shadow-sm'
                          : 'bg-base-100 text-content-muted border-line-strong hover:text-text-hi'
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5">
                  Podgląd
                </label>
                <div className="rounded-xl border border-line-strong bg-base-100 overflow-hidden">
                  {size === 'large' && preview.image && (
                    <img src={preview.image} alt="" className="w-full h-32 object-cover" />
                  )}
                  <div className="p-3 flex items-center gap-3">
                    {size !== 'large' && preview.image && size === 'medium' && (
                      <img src={preview.image} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                    )}
                    {(size === 'compact' || !preview.image) && (
                      <img src={preview.favicon} alt="" className="w-5 h-5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-text-hi truncate">
                        {customTitle.trim() || preview.title}
                      </p>
                      {size !== 'compact' && preview.description && (
                        <p className="text-[11px] text-content-muted line-clamp-2 mt-0.5">{preview.description}</p>
                      )}
                      <p className="text-[10px] text-content-muted mt-0.5">{preview.domain}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 sm:p-5 border-t border-line-strong bg-base-300/80 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-line-soft text-content-muted hover:text-text-hi text-xs font-bold border border-line-strong transition-colors cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!preview}
            className="px-5 py-2.5 rounded-xl bg-primary text-accent-ink font-bold text-xs shadow-btn hover:brightness-110 disabled:opacity-40 cursor-pointer transition-all"
          >
            Wstaw kartę linku
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsertLinkModal;
