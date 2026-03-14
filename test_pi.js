const { performance } = require('perf_hooks');

function calcPi(digits) {
    const precision = BigInt(digits + 10);
    const multiplier = 10n ** precision;
    
    function arccot(x) {
        let x2 = BigInt(x * x);
        let term = multiplier / BigInt(x);
        let sum = term;
        let n = 3n;
        let sign = -1n;
        while (term > 0n) {
            term = term / x2;
            sum += sign * (term / n);
            sign = -sign;
            n += 2n;
        }
        return sum;
    }
    
    const pi = 16n * arccot(5) - 4n * arccot(239);
    return pi.toString().slice(0, digits);
}

const start = performance.now();
const pi = calcPi(10000);
console.log(`10000 digits took ${performance.now() - start}ms`);

const start2 = performance.now();
const pi2 = calcPi(100000);
console.log(`100000 digits took ${performance.now() - start2}ms`);
