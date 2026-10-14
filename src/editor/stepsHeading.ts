/**
 * Returns true when a normalised (lowercased, trailing-punctuation-stripped)
 * heading text looks like a "Steps" heading.
 * Accepted forms: steps, step, step(s), test steps, test step, test step(s).
 */
export function isStepsHeading(text: string): boolean {
  return /^(test\s+)?step(s|\(s\))?$/.test(text);
}
