import fs from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

export async function downloadFile(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download file from ${url}`);
  const fileStream = fs.createWriteStream(dest);
  await finished(Readable.fromWeb(res.body as any).pipe(fileStream));
}
