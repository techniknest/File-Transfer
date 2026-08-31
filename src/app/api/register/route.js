import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { authService } from '@/services/authService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request) {
  try {
    await connectDB();
    
    const body = await request.json();
    const result = await authService.registerUser(body);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Register error:', error.message);
    const status = error.message === 'All fields are required' || error.message === 'User already exists' ? 400 : 500;
    return NextResponse.json(
      { error: error.message },
      { status }
    );
  }
}
