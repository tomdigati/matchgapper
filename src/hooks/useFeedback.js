import { useState, useCallback, useRef, useEffect } from "react";

export function useFeedback(autoClearMs = 3000) {
  const [feedback, setFeedback] = useState(null);
  const timerRef = useRef(null);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showFeedback = useCallback(
    (type, msg) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setFeedback({ type, msg });
      if (autoClearMs > 0) {
        timerRef.current = setTimeout(() => {
          setFeedback(null);
          timerRef.current = null;
        }, autoClearMs);
      }
    },
    [autoClearMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { feedback, showFeedback, clearFeedback };
}
