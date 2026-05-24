declare module '@google/earthengine' {
  const ee: any;
  export default ee;
}

declare module 'gifenc' {
  export function GIFEncoder(): any;
  export function quantize(data: Buffer | Uint8Array, colorCount: number): any;
  export function applyPalette(data: Buffer | Uint8Array, palette: any): any;
}
