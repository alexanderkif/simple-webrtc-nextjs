import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '../memory-store';

export const runtime = 'edge';

const isKvAvailable = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    const data = isKvAvailable
      ? await kv.get(`room:${roomId}:answer`)
      : await memoryStore.get(`room:${roomId}:answer`);

    if (!data) {
      return NextResponse.json(
        { error: 'Answer not found' },
        { status: 404 }
      );
    }

    // After receiving answer, delete both records
    if (isKvAvailable) {
      await kv.del(`room:${roomId}`);
      await kv.del(`room:${roomId}:answer`);
    } else {
      await memoryStore.del(`room:${roomId}`, `room:${roomId}:answer`);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error getting answer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
