import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '../memory-store';

export const runtime = 'edge';

const isKvAvailable = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, answer, iceCandidates } = body;

    if (!roomId || !answer) {
      return NextResponse.json(
        { error: 'Room ID and answer are required' },
        { status: 400 }
      );
    }

    const data = isKvAvailable
      ? await kv.get(`room:${roomId}`)
      : await memoryStore.get(`room:${roomId}`);

    if (!data) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    const answerData = {
      answer,
      iceCandidates: iceCandidates || [],
    };

    // Add answer to existing data
    if (isKvAvailable) {
      await kv.set(`room:${roomId}:answer`, answerData, { ex: 60 });
    } else {
      await memoryStore.set(`room:${roomId}:answer`, answerData, { ex: 60 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding answer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
