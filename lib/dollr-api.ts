/**
 * Dollr API Service
 * Handles communication with the Dollr backend for KYC operations
 */

const DOLLR_API_BASE_URL = process.env.DOLLR_API_BASE_URL || 'https://dollr-api-2crdudxdoq-bq.a.run.app';
const API_VERSION = 'v1';

export interface UploadKYCDocResponse {
  photo_url: string;
}

export interface CreateKYCResponse {
  id: number;
  photo_url: string;
  user_id: number;
  status: string;
}

export interface KYCUploadResult {
  success: boolean;
  docUrl?: string;
  kycId?: number;
  error?: string;
}

/**
 * Convert base64 image to Blob for file upload
 */
function base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Upload selfie image to Dollr KYC service
 * POST /{version}/compliance/individual-verification/photo/upload
 */
export async function uploadKYCDocument(
  imageBase64: string,
  authToken: string
): Promise<UploadKYCDocResponse> {
  const blob = base64ToBlob(imageBase64);
  const formData = new FormData();
  formData.append('file', blob, `selfie-${Date.now()}.jpg`);

  const response = await fetch(`${DOLLR_API_BASE_URL}/${API_VERSION}/compliance/individual-verification/photo/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload KYC document: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Create KYC photo record with uploaded photo URL
 * POST /{version}/compliance/individual-verification/photo/create
 */
export async function createKYCRecord(
  photoUrl: string,
  userId: number,
  authToken: string
): Promise<CreateKYCResponse> {
  const response = await fetch(`${DOLLR_API_BASE_URL}/${API_VERSION}/compliance/individual-verification/photo/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      photo_url: photoUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create KYC record: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Complete KYC verification flow:
 * 1. Upload selfie image
 * 2. Create KYC record
 */
export async function completeKYCVerification(
  imageBase64: string,
  userId: number,
  authToken: string
): Promise<KYCUploadResult> {
  try {
    // Step 1: Upload the selfie image
    const uploadResult = await uploadKYCDocument(imageBase64, authToken);
    
    if (!uploadResult.photo_url) {
      throw new Error('No photo URL returned from upload');
    }

    // Step 2: Create KYC record
    const kycRecord = await createKYCRecord(
      uploadResult.photo_url,
      userId,
      authToken
    );

    return {
      success: true,
      docUrl: uploadResult.photo_url,
      kycId: kycRecord.id,
    };
  } catch (error) {
    console.error('KYC verification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during KYC verification',
    };
  }
}
