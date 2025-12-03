import { NextResponse } from 'next/server';
import { completeKYCVerification } from '@/lib/dollr-api';
import { validateAndExtractToken } from '@/lib/token';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image, token } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Image data is required' },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication token is required' },
        { status: 400 }
      );
    }

    // Validate token and extract user info
    const tokenResult = validateAndExtractToken(token);
    
    if (!tokenResult.valid || !tokenResult.userId) {
      return NextResponse.json(
        { success: false, error: tokenResult.error || 'Invalid token' },
        { status: 401 }
      );
    }

    // Complete KYC verification with Dollr API
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
