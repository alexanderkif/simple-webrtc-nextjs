import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '../memory-store';

export const runtime = 'edge';

interface SignalingData {
  offer: RTCSessionDescriptionInit;
  iceCandidates: RTCIceCandidateInit[];
  createdAt: number;
}

// Determine KV availability
const isKvAvailable = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, offer, iceCandidates } = body;

    if (!roomId || !offer) {
      return NextResponse.json(
        { error: 'Room ID and offer are required' },
        { status: 400 }
      );
    }

    const data: SignalingData = {
      offer,
      iceCandidates: iceCandidates || [],
      createdAt: Date.now(),
    };

    // Use KV if available, otherwise memory store
    if (isKvAvailable) {
      const existing = await kv.get(`room:${roomId}`);
      if (existing) {
        // Delete old room and create new
        await kv.del(`room:${roomId}`);
        await kv.del(`room:${roomId}:answer`);
      }
      await kv.set(`room:${roomId}`, data, { ex: 300 });
    } else {
      console.warn('⚠️  Using in-memory store (development mode). For production, set up Vercel KV!');
      const existing = await memoryStore.get(`room:${roomId}`);
      if (existing) {
        // Delete old room and create new
        await memoryStore.del(`room:${roomId}`, `room:${roomId}:answer`);
      }
      await memoryStore.set(`room:${roomId}`, data, { ex: 300 });
    }

    return NextResponse.json({ success: true, usingMemoryStore: !isKvAvailable });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
