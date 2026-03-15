/**
 * Pi computation worker — powered by GMP/MPFR via WebAssembly (gmp-wasm).
 *
 * Why WASM instead of JS BigInt?
 * ─────────────────────────────
 * JS BigInt uses Karatsuba multiplication: O(n^1.585).
 * GMP (via this WASM module) uses Schönhage–Strassen FFT multiplication: O(n log n log log n).
 * For 100 M digits (~332 M bits):
 *   Karatsuba  ≈ n^1.585  ≈ 10^12 operations
 *   FFT-mul    ≈ n·log n  ≈ 10^10 operations
 * That means ~100× faster multiply for the largest operands.
 * MPFR also provides mpfr_const_pi, which uses Chudnovsky + the above FFT multiply.
 *
 * Why not GPU?
 * ────────────
 * Arbitrary-precision integer arithmetic requires sequential carry propagation
 * across thousands of "limbs" — this is fundamentally serial. WebGPU compute
 * shaders only support fixed-width types (i32/i64/f32/f64), not big integers.
 * Even FFT-based multiplication on a GPU would require a completely custom
 * WGSL implementation of multi-precision FFT — far beyond browser compute APIs.
 *
 * Streaming milestones
 * ────────────────────
 * MPFR caches its const_pi result globally in WASM memory.
 * Each call at a higher precision REFINES the cached value rather than
 * starting from scratch, so total work ≈ the cost of the final call alone.
 * We exploit this to deliver live partial pi strings while computing.
 */

import { init, precisionToBits } from 'gmp-wasm';

// Singleton — WASM module is large (~3MB decompressed), keep it loaded.
let gmpInstance: Awaited<ReturnType<typeof init>> | null = null;
async function getGMP() {
  if (!gmpInstance) {
    gmpInstance = await init();
  }
  return gmpInstance;
}

/**
 * Format the raw MPFR toString() output to exactly `digits` significant digits.
 * mpfr_get_str gives us the significant-digit mantissa with the decimal point
 * inserted by gmp-wasm's insertDecimalPoint helper, so the result is already in
 * "3.14159..." form.  We just trim to `digits` significant digits.
 */
function formatPiString(raw: string, digits: number): string {
  if (digits <= 1) return raw.slice(0, 1);
  // raw = "3.14159..." — length ≈ digits + 1 (one "." char inserted at index 1)
  return raw.slice(0, digits + 1);
}

self.onmessage = async (e: MessageEvent) => {
  const { digits } = e.data;

  try {
    self.postMessage({ type: 'progress', progress: 0.02 });

    // Load (or reuse) the GMP/MPFR WASM module.
    // The WASM binary is embedded as compressed base64 in the npm package —
    // no external file fetch needed.
    const gmp = await getGMP();

    self.postMessage({ type: 'progress', progress: 0.06 });

    // ── Streaming milestones ──────────────────────────────────────────────────
    // Compute pi at progressively higher precisions and send partial results.
    // MPFR's global cache means each step only pays for the INCREMENTAL work
    // (refining from the previous precision level).
    const MILESTONES: Array<{ d: number; p: number }> = [
      { d: 1_000,       p: 0.12 },
      { d: 10_000,      p: 0.22 },
      { d: 100_000,     p: 0.35 },
      { d: 1_000_000,   p: 0.50 },
      { d: 10_000_000,  p: 0.70 },
      { d: 50_000_000,  p: 0.85 },
    ].filter(m => m.d < digits);

    for (const { d, p } of MILESTONES) {
      // Extra 64 guard bits to ensure last few displayed digits are accurate.
      const precBits = precisionToBits(d) + 64;
      const ctx = gmp.getContext({ precisionBits: precBits });
      const pi = ctx.Pi();
      const raw = pi.toString();
      ctx.destroy(); // free MPFR variables (NOT the global const_pi cache)

      self.postMessage({ type: 'partial', piString: formatPiString(raw, d), digits: d });
      self.postMessage({ type: 'progress', progress: p });
    }

    // ── Full-precision final computation ──────────────────────────────────────
    // Extra 128 guard bits ensures the `digits` displayed digits are all correct.
    const precBits = precisionToBits(digits) + 128;

    self.postMessage({ type: 'progress', progress: 0.88 });

    const ctx = gmp.getContext({ precisionBits: precBits });
    const pi = ctx.Pi(); // MPFR const_pi — refines cached result to full precision

    self.postMessage({ type: 'progress', progress: 0.94 });

    // mpfr_get_str does O(n log^2 n) base conversion (GMP's divide-and-conquer).
    // At 100M digits this still takes time, but it is orders of magnitude faster
    // than V8 BigInt's O(n^2) naive toString().
    const raw = pi.toString();
    ctx.destroy();

    self.postMessage({ type: 'progress', progress: 0.99 });

    self.postMessage({ type: 'complete', piString: formatPiString(raw, digits) });

  } catch (err: any) {
    self.postMessage({ type: 'error', error: err?.message ?? String(err) });
  }
};

