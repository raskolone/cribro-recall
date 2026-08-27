import { useEffect, useRef } from 'react';
import { registerModal } from '../utils/modalStack';

/**
 * Hook to automatically register an active modal or popup for global ESC key dismissal.
 * 
 * @param isOpen Whether the modal is currently visible
 * @param onClose Callback to close the modal
 * @param priority Optional priority number (higher priority closes first if stacked at same time)
 */
export function useEscapeModal(isOpen: boolean, onClose?: () => void, priority: number = 0) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || !onCloseRef.current) return;

    const unregister = registerModal(() => {
      onCloseRef.current?.();
    }, priority);

    return () => {
      unregister();
    };
  }, [isOpen, priority]);
}

export default useEscapeModal;
