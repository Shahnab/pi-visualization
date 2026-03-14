import { performance } from 'perf_hooks';

function* generatePi(digits: number) {
    let q = 1n, r = 0n, t = 1n, k = 1n, n = 3n, l = 3n;
    let count = 0;
    while (count < digits) {
        if (4n * q + r - t < n * t) {
            yield Number(n);
            count++;
            let nr = 10n * (r - n * t);
            n = (10n * (3n * q + r)) / t - 10n * n;
            q *= 10n;
            r = nr;
        } else {
            let nr = (2n * q + r) * l;
            let nn = (q * (7n * k) + 2n + r * l) / (t * l);
            q *= k;
            t *= l;
            l += 2n;
            k += 1n;
            n = nn;
            r = nr;
        }
    }
}

const start = performance.now();
let count = 0;
for (const digit of generatePi(10000)) {
    count++;
}
console.log(`10000 digits took ${performance.now() - start}ms`);
