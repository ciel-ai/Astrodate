import { supabase } from './supabase';

export interface UserPhoto {
  id?: string;
  user_id: string;
  photo_url: string;
  thumbnail_url?: string;
  storage_path: string;
  is_primary: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface PhotoUploadResult {
  success: boolean;
  data?: UserPhoto;
  error?: string;
}

/**
 * Convert local file URI to base64 string (React Native compatible)
 * @param imageUri - Local URI of the image
 * @returns Base64 string ready for upload
 */
const uriToBase64 = async (imageUri: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', imageUri, true);
    xhr.responseType = 'blob';
    
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Remove 'data:image/...;base64,' prefix if present
          const base64 = base64data.includes(',') 
            ? base64data.split(',')[1] 
            : base64data;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read blob'));
        reader.readAsDataURL(xhr.response);
      } else {
        reject(new Error(`Failed to load image: HTTP ${xhr.status}`));
      }
    };
    
    xhr.onerror = () => {
      reject(new Error('Network error while loading image'));
    };
    
    xhr.ontimeout = () => {
      reject(new Error('Timeout while loading image'));
    };
    
    xhr.timeout = 30000; // 30 seconds
    
    try {
      xhr.send();
    } catch (error) {
      reject(new Error(`Failed to send request: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
};

/**
 * Uploads a photo to Supabase Storage
 * @param imageUri - Local URI of the image to upload
 * @param userId - User ID to associate with the photo
 * @param photoIndex - Index of the photo (0-based) to determine if it's primary
 * @returns Upload result with photo URL and storage path
 */
export const uploadPhotoToStorage = async (
  imageUri: string,
  userId: string,
  photoIndex: number
): Promise<{ success: boolean; photoUrl?: string; thumbnailUrl?: string; storagePath?: string; error?: string }> => {
  try {
    console.log(`📸 Converting image ${photoIndex + 1} to base64...`);
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = imageUri.split('.').pop() || 'jpg';
    const fileName = `${timestamp}_${randomString}.${fileExtension}`;
    const storagePath = `${userId}/${fileName}`;

    // Determine content type based on file extension
    const contentType = fileExtension === 'png' 
      ? 'image/png' 
      : fileExtension === 'jpg' || fileExtension === 'jpeg'
      ? 'image/jpeg'
      : fileExtension === 'webp'
      ? 'image/webp'
      : 'image/jpeg';

    // Convert image URI to base64
    let base64String: string;
    try {
      base64String = await uriToBase64(imageUri);
    } catch (error) {
      console.error('Failed to convert image to base64:', error);
      throw error;
    }

    console.log(`✅ Image ${photoIndex + 1} converted, size: ${base64String.length} characters`);

    // Decode base64 to bytes for upload
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`📤 Uploading image ${photoIndex + 1} to Supabase Storage...`);

    // Upload to Supabase Storage using bytes
    const { data, error } = await supabase.storage
      .from('user-photos')
      .upload(storagePath, bytes, {
        contentType: contentType,
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error(`❌ Error uploading photo ${photoIndex + 1} to storage:`, error);
      return {
        success: false,
        error: error.message || 'Failed to upload photo',
      };
    }

    // Get signed URL for the uploaded photo with 800px transform
    const { data: signedData, error: signedError } = await supabase.storage
      .from('user-photos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365, {
        transform: { width: 800, quality: 80 }
      }); // 1-year expiry

    if (signedError || !signedData?.signedUrl) {
      return { success: false, error: 'Failed to generate signed URL' };
    }
    const photoUrl = signedData.signedUrl;

    // Get signed URL for the thumbnail with 400px transform
    const { data: thumbData, error: thumbError } = await supabase.storage
      .from('user-photos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365, {
        transform: { width: 400, quality: 80 }
      });

    const thumbnailUrl = thumbData?.signedUrl;

    console.log(`✅ Photo ${photoIndex + 1} uploaded successfully:`, photoUrl);
    return {
      success: true,
      photoUrl,
      thumbnailUrl,
      storagePath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Exception uploading photo ${photoIndex + 1}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Saves photo metadata to the database
 * @param photo - Photo metadata to save
 * @returns Success status and photo data
 */
export const savePhotoMetadata = async (photo: Omit<UserPhoto, 'id' | 'created_at' | 'updated_at'>): Promise<PhotoUploadResult> => {
  try {
    const insertPayload: Record<string, unknown> = {
      user_id: photo.user_id,
      photo_url: photo.photo_url,
      storage_path: photo.storage_path,
      is_primary: photo.is_primary,
      display_order: photo.display_order,
    };
    if (photo.thumbnail_url !== undefined) {
      insertPayload.thumbnail_url = photo.thumbnail_url;
    }

    const { data, error } = await supabase
      .from('user_photos')
      .insert(insertPayload as any)
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving photo metadata:', error);
      return {
        success: false,
        error: error.message || 'Failed to save photo metadata',
      };
    }

    console.log('✅ Photo metadata saved successfully');
    return {
      success: true,
      data: data as UserPhoto,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception saving photo metadata:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Uploads multiple photos and saves their metadata
 * @param imageUris - Array of local URIs of images to upload
 * @param userId - User ID to associate with the photos
 * @returns Array of upload results
 */
export const uploadUserPhotos = async (
  imageUris: string[],
  userId: string
): Promise<{ success: boolean; photos?: UserPhoto[]; error?: string }> => {
  try {
    const MAX_PHOTOS_PER_USER = 6;
    const uploadedPhotos: UserPhoto[] = [];

    // Fetch existing photos so new uploads append correctly instead of conflicting on display_order.
    const existingPhotosResult = await getUserPhotos(userId);
    const existingPhotos = existingPhotosResult.success && existingPhotosResult.data
      ? existingPhotosResult.data
      : [];

    const existingCount = existingPhotos.length;
    if (existingCount >= MAX_PHOTOS_PER_USER) {
      return {
        success: false,
        error: `Maximum of ${MAX_PHOTOS_PER_USER} photos reached. Please remove a photo before uploading more.`,
      };
    }

    const remainingSlots = MAX_PHOTOS_PER_USER - existingCount;
    const photosToUpload = imageUris.slice(0, remainingSlots);

    if (photosToUpload.length === 0) {
      return {
        success: false,
        error: 'No photos to upload',
      };
    }

    // Find free display_order slots (constraint: 0..5)
    const usedOrders = new Set(existingPhotos.map(p => Number(p.display_order)));
    const freeSlots: number[] = [];
    for (let slot = 0; slot < MAX_PHOTOS_PER_USER; slot++) {
      if (!usedOrders.has(slot)) freeSlots.push(slot);
    }

    const hasPrimaryPhoto = existingPhotos.some((photo) => photo.is_primary);

    // Upload photos sequentially to avoid overwhelming the storage
    for (let i = 0; i < photosToUpload.length; i++) {
      const imageUri = photosToUpload[i];
      const displayOrder = freeSlots[i] ?? i;
      const isPrimary = !hasPrimaryPhoto && i === 0;

      // Upload to storage
      const uploadResult = await uploadPhotoToStorage(imageUri, userId, displayOrder);
      
      if (!uploadResult.success || !uploadResult.photoUrl || !uploadResult.storagePath) {
        console.error(`❌ Failed to upload photo ${i + 1}:`, uploadResult.error);
        // Continue with other photos even if one fails
        continue;
      }

      // Save metadata
      const metadataResult = await savePhotoMetadata({
        user_id: userId,
        photo_url: uploadResult.photoUrl,
        thumbnail_url: uploadResult.thumbnailUrl,
        storage_path: uploadResult.storagePath,
        is_primary: isPrimary,
        display_order: displayOrder,
      });

      if (!metadataResult.success || !metadataResult.data) {
        console.error(`❌ Failed to save photo metadata ${i + 1}:`, metadataResult.error);
        // Continue with other photos even if metadata save fails
        continue;
      }

      uploadedPhotos.push(metadataResult.data);
    }

    if (uploadedPhotos.length === 0) {
      return {
        success: false,
        error: 'Failed to upload any photos',
      };
    }

    console.log(`✅ Successfully uploaded ${uploadedPhotos.length} photos`);
    return {
      success: true,
      photos: uploadedPhotos,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception uploading photos:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Gets all photos for a user
 * @param userId - Optional user ID (defaults to current user)
 * @returns Array of user photos
 */
export const getUserPhotos = async (userId?: string) => {
  try {
    let targetUserId = userId;

    if (!targetUserId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        if (userError?.name !== 'AuthSessionMissingError' && userError?.message !== 'Auth session missing!') { console.error('❌ Could not get current user:', userError); }
        return { success: false, error: 'User not authenticated' };
      }
      targetUserId = user.id;
    }

    const { data, error } = await supabase
      .from('user_photos')
      .select('*')
      .eq('user_id', targetUserId)
      .order('is_primary', { ascending: false }) // Primary photos first
      .order('display_order', { ascending: true }); // Then by display order

    if (error) {
      console.error('❌ Error fetching photos:', error);
      console.error('❌ Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return { success: false, error: error.message };
    }

    return { success: true, data: (data as UserPhoto[]) || [] };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching photos:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

/**
 * Sets a photo as the primary photo for the current user
 */
export const setPrimaryPhoto = async (photoId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { success: false, error: 'User not authenticated' };

    const { error: clearError } = await supabase
      .from('user_photos')
      .update({ is_primary: false })
      .eq('user_id', user.id);
    if (clearError) return { success: false, error: clearError.message };

    const { error: setError } = await supabase
      .from('user_photos')
      .update({ is_primary: true })
      .eq('id', photoId);
    if (setError) return { success: false, error: setError.message };

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * Deletes a photo from storage and database
 * @param photoId - ID of the photo to delete
 * @returns Success status
 */
export const deleteUserPhoto = async (photoId: string) => {
  try {
    // Get photo metadata first
    const { data: photo, error: fetchError } = await supabase
      .from('user_photos')
      .select('storage_path')
      .eq('id', photoId)
      .single();

    if (fetchError || !photo) {
      console.error('❌ Error fetching photo to delete:', fetchError);
      return { success: false, error: 'Photo not found' };
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('user-photos')
      .remove([photo.storage_path ?? ''].filter(Boolean));

    if (storageError) {
      console.error('❌ Error deleting photo from storage:', storageError);
      // Continue to delete from database even if storage delete fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('user_photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      console.error('❌ Error deleting photo from database:', dbError);
      return { success: false, error: dbError.message };
    }

    console.log('✅ Photo deleted successfully');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception deleting photo:', errorMessage);
    return { success: false, error: errorMessage };
  }
};