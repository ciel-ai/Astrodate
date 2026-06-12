-- Allow audio/mp4 in the messages storage bucket.
-- Previously only image/* and video/* were implicitly allowed.
-- expo-av on Android records in MPEG-4 AAC (audio/mp4); Supabase rejects audio/m4a.
-- This update sets an explicit allowed_mime_types list that includes audio/mp4.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/webm'
]
WHERE id = 'messages';
