import React, {
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';

export interface MenuDropdownItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** Skrót klawiszowy pokazywany po prawej, np. „W”. */
  shortcut?: string;
  /** Element działający jak przełącznik — dostaje ptaszka i rolę menuitemcheckbox. */
  checked?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'danger';
  /** Wartość atrybutu `data-coach` — punkt zaczepienia dla samouczka. */
  coachId?: string;
}

export interface MenuDropdownSection {
  id: string;
  label?: string;
  items: MenuDropdownItem[];
}

interface MenuDropdownProps {
  sections: MenuDropdownSection[];
  /** Zawartość przycisku otwierającego. */
  trigger: ReactNode;
  triggerClassName?: string;
  triggerTitle?: string;
  /** Szerokość panelu w px. */
  width?: number;
  align?: 'start' | 'end';
  /** Kontrola z zewnątrz — samouczek otwiera menu, żeby pokazać ukryte pozycje. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  coachId?: string;
  /**
   * Blokuje przejęcie fokusu przez menu — konieczne w paskach edytora tekstu,
   * bo `execCommand` działa na zaznaczeniu, które znika, gdy fokus ucieka
   * z pola edycji do przycisku.
   */
  preserveSelection?: boolean;
  'aria-label'?: string;
}

const GAP = 8;
const VIEWPORT_MARGIN = 12;

/**
 * Menu rozwijane dla pasków narzędzi.
 *
 * Panel renderuje się w portalu na `position: fixed`, bo paski narzędzi bywają
 * w kontenerach z `overflow: hidden` i własnym kontekstem układania — menu
 * renderowane w miejscu przycięłoby się do tego kontenera albo schowało pod
 * sąsiednią kartą.
 *
 * Otwarcie można wymusić z zewnątrz (`open`), żeby samouczek pokazał pozycje,
 * które normalnie są schowane.
 */
export const MenuDropdown: React.FC<MenuDropdownProps> = ({
  sections,
  trigger,
  triggerClassName = '',
  triggerTitle,
  width = 268,
  align = 'end',
  open: controlledOpen,
  onOpenChange,
  coachId,
  preserveSelection = false,
  'aria-label': ariaLabel,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeIndex, setActiveIndex] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const flatItems = sections.flatMap(section => section.items);
  const enabledIndexes = flatItems
    .map((item, index) => (item.disabled ? -1 : index))
    .filter(index => index >= 0);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;

    const rect = triggerEl.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? 320;

    let left = align === 'end' ? rect.right - width : rect.left;
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN)
    );

    // Menu otwiera się w górę, gdy pod przyciskiem zabrakłoby miejsca —
    // inaczej ostatnie pozycje wypadłyby poza ekran i byłyby nieklikalne.
    let top = rect.bottom + GAP;
    if (top + panelHeight > window.innerHeight - VIEWPORT_MARGIN) {
      const above = rect.top - GAP - panelHeight;
      top = above >= VIEWPORT_MARGIN ? above : Math.max(VIEWPORT_MARGIN, window.innerHeight - panelHeight - VIEWPORT_MARGIN);
    }

    setPosition({ top, left });
  }, [align, width]);

  useLayoutEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(-1);
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleReposition = () => updatePosition();

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, setOpen, updatePosition]);

  const moveActive = (direction: 1 | -1) => {
    if (enabledIndexes.length === 0) return;
    const currentPosition = enabledIndexes.indexOf(activeIndex);
    const nextPosition =
      currentPosition === -1
        ? direction === 1
          ? 0
          : enabledIndexes.length - 1
        : (currentPosition + direction + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[nextPosition]);
  };

  const handleSelect = (item: MenuDropdownItem) => {
    if (item.disabled) return;
    setOpen(false);
    item.onSelect();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) setOpen(true);
        else moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!isOpen) setOpen(true);
        else moveActive(-1);
        break;
      case 'Home':
        if (isOpen) {
          event.preventDefault();
          setActiveIndex(enabledIndexes[0] ?? -1);
        }
        break;
      case 'End':
        if (isOpen) {
          event.preventDefault();
          setActiveIndex(enabledIndexes[enabledIndexes.length - 1] ?? -1);
        }
        break;
      case 'Enter':
      case ' ':
        if (isOpen && activeIndex >= 0) {
          event.preventDefault();
          handleSelect(flatItems[activeIndex]);
        }
        break;
      case 'Escape':
        if (isOpen) {
          event.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
        }
        break;
      case 'Tab':
        if (isOpen) setOpen(false);
        break;
    }
  };

  const blockFocusSteal = preserveSelection
    ? (event: React.MouseEvent) => event.preventDefault()
    : undefined;

  let renderIndex = -1;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!isOpen)}
        onMouseDown={blockFocusSteal}
        onKeyDown={handleKeyDown}
        title={triggerTitle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={ariaLabel}
        data-coach={coachId}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {typeof window !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={panelRef}
                id={menuId}
                role="menu"
                aria-label={ariaLabel}
                onKeyDown={handleKeyDown}
                tabIndex={-1}
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                style={{ top: position.top, left: position.left, width }}
                // z-500 celowo: nad przyciemnieniem samouczka (z-400), pod jego
                // dymkiem (z-600) — samouczek otwiera menu, żeby opisać pozycje,
                // które normalnie są w nim schowane.
                className="fixed z-[500] rounded-2xl bg-ink-2/98 border border-line-strong shadow-ambient-lg backdrop-blur-xl p-1.5 origin-top"
              >
                {sections.map((section, sectionIndex) => (
                  <div key={section.id}>
                    {sectionIndex > 0 && <div className="my-1.5 h-px bg-line-soft" />}
                    {section.label && (
                      <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-mono uppercase tracking-[0.12em] text-text-faint">
                        {section.label}
                      </div>
                    )}
                    {section.items.map(item => {
                      renderIndex += 1;
                      const itemIndex = renderIndex;
                      const isActive = itemIndex === activeIndex;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                          aria-checked={item.checked}
                          disabled={item.disabled}
                          data-coach={item.coachId}
                          onClick={() => handleSelect(item)}
                          onMouseDown={blockFocusSteal}
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                          className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            isActive ? 'bg-white/[0.07]' : 'bg-transparent'
                          } ${item.variant === 'danger' ? 'text-danger' : 'text-content'}`}
                        >
                          {item.icon && (
                            <span
                              className={`shrink-0 flex items-center justify-center w-4 ${
                                item.variant === 'danger' ? 'text-danger' : 'text-text-2'
                              }`}
                            >
                              {item.icon}
                            </span>
                          )}

                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-semibold truncate">{item.label}</span>
                            {item.description && (
                              <span className="block text-[11px] text-text-faint truncate">
                                {item.description}
                              </span>
                            )}
                          </span>

                          {item.checked !== undefined && (
                            <Check
                              size={13}
                              className={`shrink-0 ${item.checked ? 'text-accent' : 'text-transparent'}`}
                            />
                          )}
                          {item.shortcut && (
                            <kbd className="shrink-0 px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-line text-[10px] font-mono text-text-faint">
                              {item.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};

/** Strzałka przy etykiecie przycisku otwierającego menu. */
export const MenuChevron: React.FC<{ open?: boolean }> = ({ open }) => (
  <ChevronDown
    size={13}
    className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
  />
);

export default MenuDropdown;
