import { NextResponse } from 'next/server';
import { z } from 'zod';
import { completeKYCVerification } from '@/lib/dollr-api';
import { validateAndExtractToken } from '@/lib/token';

const VerifyRequestSchema = z.object({
  image: z.string().min(1, 'Image data is required'),
  token: z.string().min(1, 'Authentication token is required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate input with Zod
    const parsed = VerifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => e.message).join(', ');
      return NextResponse.json(
        { success: false, error: errors },
        { status: 422 }
      );
    }
    
    const { image, token } = parsed.data;

    // Validate token and extract user info
    const tokenResult = await validateAndExtractToken(token);
    
    if (!tokenResult.valid || !tokenResult.userId) {
      return NextResponse.json(
        { success: false, error: tokenResult.error || 'Invalid token' },
        { status: 401 }
      );
    }

    // Complete KYC verification 
    const kycResult = await completeKYCVerification(
      image,
      tokenResult.userId,
      token
    );

    if (!kycResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: kycResult.error || 'Verification failed',
          status: 'failed',
          userId: tokenResult.userId,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Face verification successful',
      verificationId: kycResult.kycId,
      docUrl: kycResult.docUrl,
      status: 'success',
      userId: tokenResult.userId,
    });

  } catch (error) {
    console.error('Face verification error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error during verification',
        status: 'failed',
      },
      { status: 500 }
    );
  }
}
