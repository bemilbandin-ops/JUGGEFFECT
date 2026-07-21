export interface StrobeEvaluationResult {
  isStrobeActive: boolean;
  isStrobeTriggered: boolean;
  nextLastStrobeTime: number;
}

export function evaluateStrobeTrigger(
  strobeRate: number,
  now: number,
  lastStrobeTime: number
): StrobeEvaluationResult {
  const isStrobeActive = strobeRate > 0;
  let isStrobeTriggered = false;
  let nextLastStrobeTime = lastStrobeTime;

  if (!isStrobeActive) {
    isStrobeTriggered = true;
  } else {
    if (now - lastStrobeTime >= strobeRate * 1000) {
      isStrobeTriggered = true;
      nextLastStrobeTime = now;
    }
  }

  return {
    isStrobeActive,
    isStrobeTriggered,
    nextLastStrobeTime,
  };
}
