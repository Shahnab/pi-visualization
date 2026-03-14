export function calcPi(digits: number): string {
  // Chudnovsky Algorithm with Binary Splitting
  // This is significantly faster for large numbers of digits (O(n log^3 n))
  const DIGITS_PER_TERM = 14.181647462725477;
  const nTerms = Math.floor(digits / DIGITS_PER_TERM) + 1;
  
  let termsDone = 0;
  
  // Binary splitting for the Chudnovsky series
  function bs(a: number, b: number): [bigint, bigint, bigint] {
    if (b - a === 1) {
      const ak = BigInt(a);
      const Pab = (a === 0) ? 1n : (6n * ak - 5n) * (2n * ak - 1n) * (6n * ak - 1n);
      const Qab = (a === 0) ? 1n : ak * ak * ak * 10939058860032000n;
      const Tab = Pab * (13591409n + 545140134n * ak);
      
      termsDone++;
      if (termsDone % 1000 === 0 || termsDone === nTerms) {
        self.postMessage({ type: 'progress', progress: (termsDone / nTerms) * 0.85 });
      }
      
      if (a % 2 === 1) return [Pab, Qab, -Tab];
      return [Pab, Qab, Tab];
    }
    
    const m = Math.floor((a + b) / 2);
    const [P1, Q1, T1] = bs(a, m);
    const [P2, Q2, T2] = bs(m, b);
    
    // T = T1 * Q2 + P1 * T2
    return [P1 * P2, Q1 * Q2, T1 * Q2 + P1 * T2];
  }

  const [P, Q, T] = bs(0, nTerms);
  
  self.postMessage({ type: 'progress', progress: 0.90 });
  
  // sqrt(10005) * 10^(digits + 20)
  const extraPrecision = 20;
  const unity = 10n ** BigInt(digits + extraPrecision);
  const target = 10005n * unity * unity;
  
  // Initial guess for sqrt(10005) - approx 100.024996875...
  let x = (100024996875n * (10n ** BigInt(digits + extraPrecision - 11)));
  
  // Newton's method for integer square root
  // Each iteration doubles the number of correct digits
  for (let i = 0; i < 25; i++) {
    x = (x + target / x) >> 1n;
    if (i % 5 === 0) {
      self.postMessage({ type: 'progress', progress: 0.90 + (i / 25) * 0.05 });
    }
  }
  
  self.postMessage({ type: 'progress', progress: 0.96 });
  
  // Pi = (426880 * sqrt(10005) * Q) / T
  const pi = (426880n * x * Q) / T;
  
  self.postMessage({ type: 'progress', progress: 0.98 });
  
  // For very large digit counts, toString() is the bottleneck.
  // We report progress just before it starts.
  const s = pi.toString();
  
  self.postMessage({ type: 'progress', progress: 0.99 });
  
  if (digits <= 1) return s.slice(0, 1);
  return s.slice(0, 1) + '.' + s.slice(1, digits);
}

self.onmessage = (e) => {
  const { digits } = e.data;
  try {
    const piString = calcPi(digits);
    self.postMessage({ type: 'complete', piString });
  } catch (err: any) {
    self.postMessage({ type: 'error', error: err.message });
  }
};
