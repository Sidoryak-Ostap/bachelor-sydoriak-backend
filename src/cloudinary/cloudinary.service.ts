import { Injectable } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';
const toStream = require('buffer-to-stream');

@Injectable()
export class CloudinaryService {
  async uploadImage(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto',
          folder: 'agromap_avatars',
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result)
            return reject(new Error('Cloudinary upload result is undefined'));

          resolve(result);
        },
      );

      toStream(file.buffer).pipe(upload);
    });
  }
}
