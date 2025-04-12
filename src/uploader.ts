import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { IImgInfo } from 'picgo/dist/types'
import { extractInfo } from './utils'

export interface IUploadResult {
  url: string
  imgURL: string
  index: number
}

export function createS3Client(
  accessKeyID: string,
  secretAccessKey: string,
  sessionToken: string,
  endpoint: string
) {
  return new S3Client({
    endpoint,
    region: 'auto',
    credentials: {
      accessKeyId: accessKeyID,
      secretAccessKey,
      sessionToken
    }
  })
}

export async function createUploadTask(
  s3: S3Client,
  bucketName: string,
  path: string,
  item: IImgInfo,
  index: number,
  endpoint: string
): Promise<IUploadResult> {
  if (!item.buffer && !item.base64Image) {
    throw new Error('undefined image')
  }

  const { body, contentType, contentEncoding } = await extractInfo(item)

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: path,
    Body: body,
    ContentType: contentType,
    ContentEncoding: contentEncoding
  })

  try {
    await s3.send(command)
    return {
      url: `${endpoint}/${bucketName}/${path}`,
      imgURL: path,
      index
    }
  } catch (err) {
    let message = '上传失败'
    if (err.name === 'CredentialsError') {
      message = '凭证无效，请检查AccessKey/SecretKey'
    } else if (err.name === 'NoSuchBucket') {
      message = `存储桶不存在: ${bucketName}`
    }
    throw new Error(`${message} (${err.code || err.name})`)
  }
}

export default {
  createS3Client,
  createUploadTask
}
