import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const { frames } = await req.json(); // Array of image data URLs or buffers

    if (!frames || frames.length === 0) {
      return NextResponse.json({ success: false, error: 'No frames provided' }, { status: 400 });
    }

    // GIF Encoding logic
    const gif = GIFEncoder();
    
    for (const frame of frames) {
      const timeout = Date.now() - startTime;
      if (timeout > 6000) {
        // Break early if exceeding 6s to return PNG fallback
        throw new Error('GIF_TIMEOUT');
      }

      const imgBuffer = Buffer.from(frame.split(',')[1], 'base64');
      const { data, info } = await sharp(imgBuffer)
        .resize(400, 500)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const palette = quantize(data, 256);
      const index = applyPalette(data, palette);
      gif.writeFrame(index, info.width, info.height, { palette, delay: 500 });
    }

    gif.finish();
    const gifBuffer = Buffer.from(gif.bytes());

    return new NextResponse(gifBuffer, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error: any) {
    if (error.message === 'GIF_TIMEOUT') {
      return NextResponse.json({ success: false, error: 'GIF generation took too long, fallback to PNG' }, { status: 504 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
