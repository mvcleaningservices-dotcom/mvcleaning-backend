import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Signed Cloudinary uploads.
 *
 * The client never sees the API secret. It asks us to sign a short set of upload
 * params (timestamp + folder); we return the signature, and the client uploads
 * the file DIRECTLY to Cloudinary with it. So image bytes never pass through our
 * backend — only the tiny signature does. Cloudinary rejects any upload whose
 * signature doesn't match, so a signature can't be abused to upload arbitrary
 * params.
 */
@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {}

  private creds() {
    const cloudName = this.config.get<string>('cloudinary.cloudName');
    const apiKey = this.config.get<string>('cloudinary.apiKey');
    const apiSecret = this.config.get<string>('cloudinary.apiSecret');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Image uploads are not configured (missing CLOUDINARY_* env vars).',
      );
    }
    return { cloudName, apiKey, apiSecret };
  }

  /**
   * Produce the params the client needs to POST directly to Cloudinary.
   * `folder` keeps assets tidy (e.g. mv-cleaning/blog, mv-cleaning/services).
   */
  signUpload(folder: string) {
    const { cloudName, apiKey, apiSecret } = this.creds();
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = { folder, timestamp };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
    return {
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    };
  }
}
