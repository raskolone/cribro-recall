// Global modal stack to handle Escape key across all modals, popups and dialogs in LIFO order.

type ModalCloseHandler = () => void;

interface ModalEntry {
  id: string;
  onClose: ModalCloseHandler;
  priority?: number;
}

const modalStack: ModalEntry[] = [];

/**
 * Register a modal's close handler.
 * Returns an unregister function to be called on modal close/unmount.
 */
export function registerModal(onClose: ModalCloseHandler, priority: number = 0): () => void {
  const id = `modal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  modalStack.push({ id, onClose, priority });
  
  return () => {
    const index = modalStack.findIndex(entry => entry.id === id);
    if (index !== -1) {
      modalStack.splice(index, 1);
    }
  };
}

/**
 * Closes the topmost active modal when Escape is pressed.
 * Returns true if a modal was closed, false otherwise.
 */
export function handleGlobalEscape(): boolean {
  if (modalStack.length === 0) {
    return false;
  }

  // Pop the topmost modal
  const top = modalStack.pop();
  if (top && typeof top.onClose === 'function') {
    try {
      top.onClose();
    } catch (e) {
      console.error('Error closing modal on ESC:', e);
    }
    return true;
  }

  return false;
}

/**
 * Returns current count of open modals in the stack.
 */
export function getOpenModalsCount(): number {
  return modalStack.length;
}
