import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const startTime = Date.now();
  
  try {
    const { bbox } = await req.json().catch(() => ({}));

    // Temporary high-fidelity mock: return a simulated change array 
    // to verify visualization while local inference is being fixed.
    const mockData = Array.from({ length: 224 * 224 }, () => Math.random() > 0.9 ? 1 : 0);
    
    return NextResponse.json({
      success: true,
      mode: 'prithvi', // We use 'prithvi' mode here to trigger client-side visualization
      data: mockData,
      meta: {
        processingTime: Date.now() - startTime,
        cached: false,
        engine: 'Simulated Engine'
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: true,
      mode: 'gee',
      meta: { processingTime: Date.now() - startTime }
    });
  }
}
