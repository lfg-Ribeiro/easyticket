import { useCallback, useRef } from "react";

function createBeep(frequency: number, duration: number, volume: number = 0.3): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      gainNode.gain.value = volume;

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        ctx.close();
        resolve();
      }, duration);
    } catch {
      resolve();
    }
  });
}

export function useScannerAudio() {
  const lastPlayedRef = useRef(0);

  const playSuccess = useCallback(async () => {
    const now = Date.now();
    if (now - lastPlayedRef.current < 500) return;
    lastPlayedRef.current = now;
    await createBeep(880, 150, 0.3);
    await createBeep(1320, 200, 0.3);
  }, []);

  const playError = useCallback(async () => {
    const now = Date.now();
    if (now - lastPlayedRef.current < 500) return;
    lastPlayedRef.current = now;
    await createBeep(300, 200, 0.4);
    await createBeep(200, 300, 0.4);
  }, []);

  return { playSuccess, playError };
}
