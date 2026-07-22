import { getStrobePresentation } from './strobeEvaluator';

function assertEqual(actual: string, expected: string): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

assertEqual(getStrobePresentation(false, 'flash', 100), 'live');
assertEqual(getStrobePresentation(true, 'freeze', 100), 'held');
assertEqual(getStrobePresentation(true, 'flash', 40), 'held');
assertEqual(getStrobePresentation(true, 'flash', 41), 'black');
console.log('Strobe presentation tests passed.');
