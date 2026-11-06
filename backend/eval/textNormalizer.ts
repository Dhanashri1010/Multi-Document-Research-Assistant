/**
 * Robust text normalizer for comparing expected answer spans and queries with extracted PDF text.
 * Handles:
 * - Greek symbols (α, β, ∆, θ, ε, σ, λ) <-> English names (alpha, beta, delta, theta, epsilon, sigma, lambda)
 * - Unicode math superscripts / subscripts (², ³, ̂, etc.)
 * - LaTeX math tokens (\hat, \frac, \sqrt, _, ^, {, })
 * - Spacing inside formulas like "F ( x ) + x", "O ( n 2 )", "350 GB" vs "350GB"
 */
export function normalizeTextForMatching(text: string): string {
  if (!text) return '';

  return (
    text
      .toLowerCase()
      // Greek unicode to latin names
      .replace(/[\u03B1\u0391]/g, ' alpha ')
      .replace(/[\u03B2\u0392]/g, ' beta ')
      .replace(/[\u0394\u2206]/g, ' delta ')
      .replace(/[\u03B8\u0398]/g, ' theta ')
      .replace(/[\u03B5\u0395\u03F5]/g, ' epsilon ')
      .replace(/[\u03C3\u03A3]/g, ' sigma ')
      .replace(/[\u03BB\u039B]/g, ' lambda ')
      .replace(/[\u221A]/g, ' sqrt ')
      // Accents / hats / tildes
      .replace(/[\u0302\u0303\u0304]/g, '')
      .replace(/\\?hat\{([^}]+)\}/g, '$1')
      .replace(/\\?tilde\{([^}]+)\}/g, '$1')
      .replace(/\\?sqrt\{([^}]+)\}/g, 'sqrt $1')
      .replace(/\\?frac\{([^}]+)\}\{([^}]+)\}/g, '$1 / $2')
      .replace(/\\?mathbf\{([^}]+)\}/g, '$1')
      .replace(/\\?math[a-zA-Z]+\{([^}]+)\}/g, '$1')
      // Superscripts / subscripts
      .replace(/[²\u00B2]/g, ' 2 ')
      .replace(/[³\u00B3]/g, ' 3 ')
      .replace(/\^2/g, ' 2 ')
      .replace(/\^t/gi, ' t ')
      .replace(/\^\{([^}]+)\}/g, ' $1 ')
      .replace(/_\{([^}]+)\}/g, ' $1 ')
      .replace(/_([0-9a-zA-Z])/g, ' $1 ')
      // Math operators & brackets: collapse spaces around them
      .replace(/[*·•]/g, ' ')
      .replace(/[^\w\s\d]/g, ' ')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Checks if a haystack chunk contains a needle answer span under fuzzy/normalized matching.
 */
export function containsNormalized(haystack: string, needle: string): boolean {
  if (!needle || !needle.trim()) return false;
  const normHaystack = normalizeTextForMatching(haystack);
  const normNeedle = normalizeTextForMatching(needle);

  if (!normNeedle) return false;

  // Direct normalized substring
  if (normHaystack.includes(normNeedle)) return true;

  // Compact matching (remove all spaces)
  const compactHaystack = normHaystack.replace(/\s+/g, '');
  const compactNeedle = normNeedle.replace(/\s+/g, '');
  if (compactNeedle.length >= 3 && compactHaystack.includes(compactNeedle)) return true;

  return false;
}
