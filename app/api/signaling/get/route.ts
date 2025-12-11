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
      ? await kv.get(`room:${roomId}`)
      : await memoryStore.get(`room:${roomId}`);

    if (!data) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error getting room:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
