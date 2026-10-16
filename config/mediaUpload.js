import { Platform } from 'react-native';
import { File, UploadType } from 'expo-file-system';

const CLOUDINARY_CLOUD_NAME = 'dx0mmgase';
const CLOUDINARY_UPLOAD_PRESET = 'Comm-connect';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

const uploadImage = async (uri, index) => {
  let responseBody;
  let status;

  if (Platform.OS === 'web') {
    const fileResponse = await fetch(uri);
    if (!fileResponse.ok) throw new Error('Could not read the selected image. Please choose it again.');
    const fileBlob = await fileResponse.blob();
    const formData = new FormData();
    formData.append('file', fileBlob, `help_listing_${Date.now()}_${index}.jpg`);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const response = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
    status = response.status;
    responseBody = await response.json();
  } else {
    const file = new File(uri);
    const result = await file.upload(CLOUDINARY_UPLOAD_URL, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'image/jpeg',
      parameters: { upload_preset: CLOUDINARY_UPLOAD_PRESET },
    });
    status = result.status;
    try { responseBody = JSON.parse(result.body); }
    catch { throw new Error('The image service returned an unreadable response.'); }
  }

  if (status < 200 || status >= 300 || !responseBody?.secure_url) {
    throw new Error(responseBody?.error?.message || `Image upload failed (${status}).`);
  }
  return responseBody.secure_url;
};

export const isRemoteMediaUrl = (url) => /^https?:\/\//i.test(url || '');

export const uploadReportImages = async (uris = []) => {
  const uploadedUrls = [];

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];

    if (isRemoteMediaUrl(uri)) {
      uploadedUrls.push(uri);
      continue;
    }

    uploadedUrls.push(await uploadImage(uri, i));
  }

  return uploadedUrls;
};
