/**
 * Face Detection and Verification Utility (Edge Function Client)
 * 
 * This module provides functions to:
 * 1. Detect if an image contains a human face (calls Edge Function with Gemini API)
 * 2. Verify that all uploaded images are of the same person (calls Edge Function with Gemini API)
 * 
 * All processing happens server-side in Supabase Edge Function using Google Gemini API
 * Gemini API key is securely stored in Supabase secrets
 * 
 * Note: The Edge Function uses Gemini's vision capabilities for:
 * - Face detection in images
 * - Face comparison between images (multimodal analysis)
 */


import { fetchWithTimeout } from './network';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';

// Edge Function URL — derived from the single source-of-truth SUPABASE_URL
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/face-verification`;

export interface FaceDetectionResult {
  success: boolean;
  hasFace: boolean;
  faceCount: number;
  faceEmbedding?: number[]; // Optional: May be provided for backward compatibility
  faceConfidence?: number;
  error?: string;
}

export interface FaceVerificationResult {
  success: boolean;
  isSamePerson: boolean;
  confidence: number;
  error?: string;
}

interface VerifyAllPhotosResult {
  success: boolean;
  allHaveFaces: boolean;
  allSamePerson: boolean;
  faceEmbeddings: (number[] | null)[];
  errors: string[];
}

/**
 * Converts image URI to base64 string for transmission to Edge Function
 */
const imageUriToBase64 = async (uri: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', uri, true);
    xhr.responseType = 'blob';

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          const base64 = base64data.includes(',')
            ? base64data.split(',')[1]
            : base64data;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(xhr.response);
      } else {
        reject(new Error(`Failed to load image: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error while loading image'));
    xhr.ontimeout = () => reject(new Error('Timeout while loading image'));
    xhr.timeout = 30000;

    try {
      xhr.send();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Detects faces in an image by calling Supabase Edge Function (using Gemini API)
 * Returns face detection results
 * 
 * The Edge Function uses Gemini's vision capabilities to:
 * - Detect faces in the image
 * - Count the number of faces
 * - Optionally extract facial features/embeddings
 */
export const detectFaceInImage = async (
  imageUri: string
): Promise<FaceDetectionResult> => {
  try {
    console.log('📸 Detecting face in image using Gemini API:', imageUri);

    // Convert image to base64
    const base64Image = await imageUriToBase64(imageUri);

    // Call Edge Function (which uses Gemini API internally)
    const response = await fetchWithTimeout(
      EDGE_FUNCTION_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'detect',
          base64Image,
          provider: 'gemini', // Indicate we're using Gemini API
        }),
      },
      20000
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || `HTTP ${response.status}`;
      console.error('❌ Edge Function error:', errorMsg);
      return {
        success: false,
        hasFace: false,
        faceCount: 0,
        error: errorMsg,
      };
    }

    const data = await response.json();

    if (!data.success) {
      console.error('❌ Face detection failed:', data.error);
      return {
        success: false,
        hasFace: false,
        faceCount: 0,
        error: data.error || 'Face detection service error',
      };
    }

    console.log('✅ Face detection result:', data);
    return data as FaceDetectionResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Face detection exception:', errorMessage);
    return {
      success: false,
      hasFace: false,
      faceCount: 0,
      error: `Face detection failed: ${errorMessage}`,
    };
  }
};

/**
 * Verifies that two images show the same person
 * Calls Supabase Edge Function which uses Gemini API for multimodal image comparison
 * 
 * Note: With Gemini API, we compare images directly rather than embeddings.
 * The Edge Function will use Gemini's vision capabilities to analyze both images
 * and determine if they show the same person.
 * 
 * @param imageUri1 - URI of the first image (primary/reference photo)
 * @param imageUri2 - URI of the second image to compare
 */
export const verifySamePerson = async (
  imageUri1: string,
  imageUri2: string
): Promise<FaceVerificationResult> => {
  try {
    console.log('🔍 Verifying if faces match using Gemini API');

    // Convert both images to base64
    const [base64Image1, base64Image2] = await Promise.all([
      imageUriToBase64(imageUri1),
      imageUriToBase64(imageUri2),
    ]);

    // Call Edge Function (which uses Gemini API for image comparison)
    const response = await fetchWithTimeout(
      EDGE_FUNCTION_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'verify',
          base64Image1,
          base64Image2,
          provider: 'gemini', // Indicate we're using Gemini API
        }),
      },
      20000
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || `HTTP ${response.status}`;
      console.error('❌ Edge Function error:', errorMsg);
      return {
        success: false,
        isSamePerson: false,
        confidence: 0,
        error: errorMsg,
      };
    }

    const data = await response.json();

    if (!data.success) {
      console.error('❌ Verification failed:', data.error);
      return {
        success: false,
        isSamePerson: false,
        confidence: 0,
        error: data.error || 'Verification service error',
      };
    }

    console.log('✅ Verification result:', data);
    return data as FaceVerificationResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Verification exception:', errorMessage);
    return {
      success: false,
      isSamePerson: false,
      confidence: 0,
      error: `Verification failed: ${errorMessage}`,
    };
  }
};

/**
 * Verifies that all images contain faces and are of the same person
 * Calls Supabase Edge Function for batch verification using Gemini API
 * 
 * The Edge Function uses Gemini's multimodal capabilities to:
 * - Detect faces in all images
 * - Compare all images to verify they show the same person
 */
export const verifyAllPhotos = async (
  imageUris: string[]
): Promise<{
  success: boolean;
  allHaveFaces: boolean;
  allSamePerson: boolean;
  faceEmbeddings: (number[] | null)[]; // Kept for backward compatibility, may be null with Gemini
  errors: string[];
}> => {
  try {
    console.log('📸 Verifying all photos using Gemini API:', imageUris.length, 'images');

    // Convert all images to base64
    const base64Images = await Promise.all(
      imageUris.map(uri => imageUriToBase64(uri))
    );

    // Call Edge Function (which uses Gemini API for batch verification)
    const response = await fetchWithTimeout(
      EDGE_FUNCTION_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'verifyAll',
          base64Images,
          provider: 'gemini', // Indicate we're using Gemini API
        }),
      },
      20000
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || `HTTP ${response.status}`;
      console.error('❌ Edge Function error:', errorMsg);
      return {
        success: false,
        allHaveFaces: false,
        allSamePerson: false,
        faceEmbeddings: [],
        errors: [errorMsg],
      };
    }

    const data = await response.json();

    if (!data.success) {
      console.error('❌ Batch verification failed:', data.errors);
      return {
        success: false,
        allHaveFaces: data.allHaveFaces || false,
        allSamePerson: data.allSamePerson || false,
        faceEmbeddings: data.faceEmbeddings || [],
        errors: data.errors || ['Batch verification service error'],
      };
    }

    console.log('✅ Batch verification result:', data);
    return data as VerifyAllPhotosResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Batch verification exception:', errorMessage);
    return {
      success: false,
      allHaveFaces: false,
      allSamePerson: false,
      faceEmbeddings: [],
      errors: [errorMessage],
    };
  }
};