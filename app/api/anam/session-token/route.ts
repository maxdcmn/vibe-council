import { NextResponse } from 'next/server';
import { getPersonaConfig } from '@/lib/anam-personas';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANAM_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANAM_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { personaId, personaConfig } = body;

    // Get base persona config by ID, or use default
    const basePersonaConfig = getPersonaConfig(personaId);

    // Merge with any provided personaConfig overrides
    const finalPersonaConfig = { ...basePersonaConfig, ...personaConfig };

    const response = await fetch('https://api.anam.ai/v1/auth/session-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personaConfig: finalPersonaConfig,
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
