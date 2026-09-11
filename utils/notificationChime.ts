/**
 * Dwutonowy sygnał powiadomień.
 *
 * Generowany oscylatorem, a nie wczytywany z pliku: nie dokłada żądania
 * sieciowego, działa offline i nie zależy od zewnętrznego hostingu, z którego
 * plik potrafi zniknąć. Ten sam dźwięk obsługuje wszystkie powiadomienia
 * w aplikacji, żeby lektor rozpoznawał go bez patrzenia na ekran.
 */
export function playNotificationChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.45);

    // Kontekst audio zamykamy po wybrzmieniu — przeglądarki ograniczają liczbę
    // jednocześnie otwartych, a powiadomień w trakcie lekcji bywa sporo.
    oscillator.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch {
    // Zasady autoodtwarzania potrafią zablokować dźwięk przed pierwszym
    // kliknięciem użytkownika. Powiadomienie ma też warstwę wizualną,
    // więc brak dźwięku niczego nie psuje.
  }
}

export default playNotificationChime;
