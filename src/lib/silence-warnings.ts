/**
 * Global Warning Suppressor for Node.js
 * Prevents DeprecationWarning: url.parse() from flooding Vercel logs.
 * This is caused by legacy dependencies like 'xmlhttprequest'.
 */

if (typeof process !== 'undefined') {
  const originalEmit = process.emit;
  
  // @ts-ignore
  process.emit = function (name, data) {
    if (
      name === 'warning' &&
      typeof data === 'object' &&
      (data as any).code === 'DEP0169'
    ) {
      return false;
    }
    return originalEmit.apply(process, arguments as any);
  };
}

export {};
