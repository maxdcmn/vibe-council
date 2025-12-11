import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const apiKey = process.env.ANAM_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANAM_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.anam.ai/v1/auth/session-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personaConfig: {
          name: 'Cara',
          avatarId: '30fa96d0-26c4-4e55-94a0-517025942e18',
          voiceId: '6bfbe25a-979d-40f3-a92b-5394170af54b',
          llmId: '0934d97d-0c3a-4f33-91b0-5e136a0ef466',
          systemPrompt:
            'You are Cara, a helpful and friendly AI assistant. Keep responses conversational and concise.',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to create session token' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ sessionToken: data.sessionToken });
  } catch (error) {
    console.error('Error creating session token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
