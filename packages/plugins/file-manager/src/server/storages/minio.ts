import { AttachmentModel } from '.';
import { STORAGE_TYPE_MINIO } from '../constants';
import { cloudFilenameGetter } from '../utils';

export default {
  filenameKey: 'key',
  make(storage) {
    const { S3Client } = require('@aws-sdk/client-s3');
    const multerS3 = require('multer-s3');
    const { baseUrl } = storage;
    const { accessKeyId, secretAccessKey, bucket, acl = 'public-read', ...options } = storage.options;

    const s3 = new S3Client({
      ...options,
      endpoint: baseUrl,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    return multerS3({
      s3,
      bucket,
      acl,
      contentType(req, file, cb) {
        if (file.mimetype) {
          cb(null, file.mimetype);
          return;
        }

        multerS3.AUTO_CONTENT_TYPE(req, file, cb);
      },
      key: cloudFilenameGetter(storage),
    });
  },
  defaults() {
    return {
      title: 'MinIO S3',
      name: 'minio-s3',
      type: STORAGE_TYPE_MINIO,
      baseUrl: process.env.MINIO_S3_STORAGE_BASE_URL,
      options: {
        region: process.env.MINIO_S3_REGION,
        accessKeyId: process.env.MINIO_ACCESS_KEY_ID,
        secretAccessKey: process.env.MINIO_SECRET_ACCESS_KEY,
        bucket: process.env.MINIO_S3_BUCKET,
      },
    };
  },
  async delete(storage, records: AttachmentModel[]): Promise<[number, AttachmentModel[]]> {
    const { DeleteObjectsCommand } = require('@aws-sdk/client-s3');
    const { s3 } = this.make(storage);
    const { Deleted } = await s3.send(
      new DeleteObjectsCommand({
        Bucket: storage.options.bucket,
        Delete: {
          Objects: records.map((record) => ({ Key: `${record.path}/${record.filename}` })),
        },
      }),
    );

    return [
      Deleted.length,
      records.filter(
        (record) =>
          !Deleted.find((item) => item.Key === `${record.path}/${record.filename}` || item.Key === record.filename),
      ),
    ];
  },
};
