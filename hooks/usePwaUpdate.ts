import { useCallback, useSyncExternalStore } from 'react';
import { getPwaUpdater } from '../services/pwaUpdates';

const NOOP_STATE = { updateReady: false, dismissed: false } as const;
const noopSubscribe = () => () => {};

/** Stan baneru „Dostępna nowa wersja". Bez service workera zawsze „brak aktualizacji". */
export function usePwaUpdate() {
  const updater = getPwaUpdater();
  const state = useSyncExternalStore(
    updater ? updater.subscribe : noopSubscribe,
    updater ? updater.getState : () => NOOP_STATE,
    () => NOOP_STATE
  );
  const apply = useCallback(() => updater?.applyUpdate() ?? false, [updater]);
  const dismiss = useCallback(() => updater?.dismiss(), [updater]);
  return { visible: state.updateReady && !state.dismissed, apply, dismiss };
}
