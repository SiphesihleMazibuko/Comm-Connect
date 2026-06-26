const CLOUDINARY_CLOUD_NAME = 'dx0mmgase';
const CLOUDINARY_UPLOAD_PRESET = 'Comm-connect';

export const isRemoteMediaUrl = (url) => /^https?:\/\//i.test(url || '');

export const uploadReportImages = async (uris = []) => {
  const uploadedUrls = [];

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];

    if (isRemoteMediaUrl(uri)) {
      uploadedUrls.push(uri);
      continue;
    }

    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: `report_${Date.now()}_${i}.jpg`,
    });
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    const data = await response.json();

    if (!data.secure_url) {
      throw new Error(data.error?.message || 'No URL returned from Cloudinary');
    }

    uploadedUrls.push(data.secure_url);
  }

  return uploadedUrls;
};
