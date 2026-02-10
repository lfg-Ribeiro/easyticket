import { useState, useEffect, useCallback } from "react";

export function useCountdown(durationSeconds: number) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [isActive, setIsActive] = useState(false);

  const isExpired = isActive && secondsLeft <= 0;

  useEffect(() => {
    if (!isActive || secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [isActive, secondsLeft]);

  const start = useCallback(() => {
    setSecondsLeft(durationSeconds);
    setIsActive(true);
  }, [durationSeconds]);

  const reset = useCallback(() => {
    setSecondsLeft(durationSeconds);
    setIsActive(false);
  }, [durationSeconds]);

  const formatted = `${Math.floor(Math.max(0, secondsLeft) / 60)
    .toString()
    .padStart(2, "0")}:${(Math.max(0, secondsLeft) % 60)
    .toString()
    .padStart(2, "0")}`;

  return { secondsLeft, isActive, isExpired, formatted, start, reset };
}
