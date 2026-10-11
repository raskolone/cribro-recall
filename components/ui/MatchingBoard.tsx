import React from 'react';
import { Check, X } from 'lucide-react';
import i18n from 'i18next';
import { gameTileAttrs, type GameTileState } from '../../utils/gameTile';
import { pairShade } from '../../utils/matchingBoard';

/**
 * Plansza „Dopasuj pary” — wspólny, czysto prezentacyjny komponent pracy domowej i ćwiczeń dowolnych.
 *
 * Kolejność kafelków przychodzi z góry (`utils/matchingBoard.ts`) i tu się nie zmienia: ani przy
 * zaznaczeniu, ani przy trafieniu, błędzie czy ponownym renderze. Po lewej angielski, po prawej polski,
 * wiersze siatki wyrównują wysokość kafelków. Trafiona para zostaje na miejscu, zablokowana, w jednym
 * pastelowym odcieniu (kolejne trafienia → kolejne odcienie); odcień pojawia się dopiero po trafieniu.
 * Stan niesie obwódka, ikona i tekst dla czytników — nigdy sam kolor.
 */
export interface BoardTileView {
  key: string;
  pairId: string;
  text: string;
}

export interface MatchingBoardProps {
  left: BoardTileView[];
  right: BoardTileView[];
  /** `pairId` trafionych par w kolejności trafień (od niej zależy odcień). */
  hits: readonly string[];
  selectedKey: string | null;
  wrongKeys: readonly string[];
  onPick: (key: string) => void;
  /** Dodatek pod tekstem kafelka angielskiego (np. przyciski wymowy UK/US). */
  renderLeftAddon?: (tile: BoardTileView) => React.ReactNode;
  /** Atrybut do znajdowania kafelków w testach/automatyzacji. */
  tileTestId?: string;
}

const MatchingBoard: React.FC<MatchingBoardProps> = ({
  left,
  right,
  hits,
  selectedKey,
  wrongKeys,
  onPick,
  renderLeftAddon,
  tileTestId,
}) => {
  const rows = Math.max(left.length, right.length);

  const renderTile = (tile: BoardTileView, side: 'left' | 'right') => {
    const matched = hits.includes(tile.pairId);
    const wrong = wrongKeys.includes(tile.key);
    const selected = selectedKey === tile.key;
    const state: GameTileState = matched ? 'locked' : wrong ? 'wrong' : selected ? 'selected' : 'rest';
    const addon = side === 'left' && !matched && renderLeftAddon ? renderLeftAddon(tile) : null;
    const attrs = gameTileAttrs({
      state,
      shade: matched ? pairShade(hits, tile.pairId) : undefined,
      toggle: !matched,
      extraClass: addon ? 'game-tile--marked game-tile--stack' : 'game-tile--marked',
    });
    return (
      <div
        key={tile.key}
        role="button"
        tabIndex={matched ? -1 : 0}
        data-testid={tileTestId}
        data-tile-key={tile.key}
        data-side={side}
        {...attrs}
        onClick={() => onPick(tile.key)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPick(tile.key);
          }
        }}
      >
        {matched && <Check aria-hidden="true" size={18} strokeWidth={3} className="game-tile__mark" />}
        {wrong && <X aria-hidden="true" size={18} strokeWidth={3} className="game-tile__mark" />}
        <span className="min-w-0">{tile.text}</span>
        {addon && (
          <div data-pronunciation onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {addon}
          </div>
        )}
        {matched && <span className="sr-only">{i18n.t('Dopasowano')}</span>}
        {wrong && <span className="sr-only">{i18n.t('Błędna para')}</span>}
        {selected && !matched && !wrong && <span className="sr-only">{i18n.t('Zaznaczone')}</span>}
      </div>
    );
  };

  return (
    <div
      data-testid="matching-board"
      className="grid grid-flow-col grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4"
      style={{ gridTemplateRows: `repeat(${rows}, minmax(3.5rem, auto))` }}
    >
      {left.map((tile) => renderTile(tile, 'left'))}
      {right.map((tile) => renderTile(tile, 'right'))}
    </div>
  );
};

export default MatchingBoard;
