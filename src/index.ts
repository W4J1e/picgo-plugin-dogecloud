
import {IOldReqOptionsWithJSON, IPicGo} from 'picgo'
import uploader, {IUploadResult} from './uploader'
import {formatPath} from './utils'
import * as fs from 'fs'
import crypto from 'crypto'

interface IS3UserConfig {
  AccessKey: string
  SecretKey: string
  bucketName: string
  uploadPath: string
  urlPrefix?: string
  urlSuffix?: string
}

interface ITokenData {
  credentials: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken: string
  }
  s3Bucket: string
  s3Endpoint: string
  expiresAt?: number
}

export = (ctx: IPicGo) => {
  const getTokenStruct = (accessKey: string, secretKey: string, _bucket: string): IOldReqOptionsWithJSON => {
    const bucketName = _bucket.split('-').slice(3, -1).join('-')
    const bodyJSON = JSON.stringify({
      channel: 'OSS_UPLOAD',
      scopes: [bucketName + ':' + '*']
    })
    const apiUrl = '/auth/tmp_token.json'
    const signStr = apiUrl + '\n' + bodyJSON
    const sign = crypto.createHmac('sha1', secretKey)
      .update(Buffer.from(signStr, 'utf8'))
      .digest('hex')
    const authorization = 'TOKEN ' + accessKey + ':' + sign
    const Url = 'https://api.dogecloud.com' + apiUrl
    
    return {
      method: 'POST',
      url: Url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization
      },
      body: {
        channel: 'OSS_UPLOAD',
        scopes: [bucketName + ':' + '*']
      },
      json: true
    }
  }

  const config = (ctx: IPicGo) => {
    const defaultConfig: IS3UserConfig = {
      AccessKey: '',
      SecretKey: '',
      bucketName: '',
      uploadPath: '{year}/{month}/{md5}.{extName}'
    }
    let userConfig = ctx.getConfig<IS3UserConfig>('picBed.dogecloud')
    userConfig = {...defaultConfig, ...(userConfig || {})}
    
    return [
      {
        name: 'AccessKey',
        type: 'input',
        default: userConfig.AccessKey,
        required: true,
        message: 'AccessKey',
        alias: '用户AccessKey'
      },
      {
        name: 'SecretKey',
        type: 'password',
        default: userConfig.SecretKey,
        required: true,
        message: 'SecretKey',
        alias: '用户SecretKey'
      },
      {
        name: 'bucketName',
        type: 'input',
        default: userConfig.bucketName,
        required: true,
        alias: 's3bucket'
      },
      {
        name: 'urlPrefix',
        type: 'input',
        default: userConfig.urlPrefix,
        message: '云存储绑定的cdn域名',
        required: true,
        alias: '加速域名'
      },
      {
        name: 'uploadPath',
        type: 'input',
        default: userConfig.uploadPath,
        message: '为空则以原始文件名上传到根目录',
        required: false,
        alias: '上传路径'
      },
      {
        name: 'urlSuffix',
        type: 'input',
        default: userConfig.urlSuffix,
        message: '如开启了图片处理则可以填写此项',
        required: false,
        alias: '自定义后缀'
      }
    ]
  }

  const handle = async (ctx: IPicGo) => {
    const userConfig: IS3UserConfig = ctx.getConfig('picBed.dogecloud')
    if (!userConfig) {
      throw new Error("Can't find dogecloud uploader config")
    }
    if (userConfig.urlPrefix) {
      userConfig.urlPrefix = userConfig.urlPrefix.replace(/\/?$/, '')
    }

    const tokenCachePath = require('path').join(ctx.baseDir, 'token.json')
    let tokenData: ITokenData | null = null
    
    // 尝试读取缓存token
    if (fs.existsSync(tokenCachePath)) {
      try {
        const cachedData = JSON.parse(fs.readFileSync(tokenCachePath, 'utf-8'))
        const tokenAge = (Date.now() - fs.statSync(tokenCachePath).mtimeMs) / 1000
        
        if (tokenAge < 3500 && cachedData.s3Bucket === userConfig.bucketName) {
          tokenData = cachedData
          ctx.log.info('使用缓存的临时token')
        }
      } catch (e) {
        ctx.log.warn('token缓存读取失败:', e)
      }
    }

    // 需要刷新token的情况
    if (!tokenData) {
      try {
        interface ITokenResponse {
          code: number
          msg?: string
          err_code?: string
          data?: {
            Credentials: {
              accessKeyId: string
              secretAccessKey: string
              sessionToken: string
            }
            Buckets: Array<{
              s3Bucket: string
              s3Endpoint: string
            }>
          }
        }

        const tokenResponse = await ctx.request(getTokenStruct(
          userConfig.AccessKey, 
          userConfig.SecretKey, 
          userConfig.bucketName
        )) as ITokenResponse
        
        if (tokenResponse.code !== 200 || !tokenResponse.data) {
          throw new Error(`获取token失败: ${tokenResponse.msg || '未知错误'} (${tokenResponse.err_code || '未知错误码'})`)
        }

        const targetBucket = tokenResponse.data.Buckets.find(b => b.s3Bucket === userConfig.bucketName)
        if (!targetBucket) {
          throw new Error(`未找到配置的存储桶: ${userConfig.bucketName}`)
        }

        tokenData = {
          credentials: tokenResponse.data.Credentials,
          s3Bucket: targetBucket.s3Bucket,
          s3Endpoint: targetBucket.s3Endpoint,
          expiresAt: Date.now() + 3500 * 1000
        }

        fs.writeFileSync(tokenCachePath, JSON.stringify(tokenData))
      } catch (err) {
        ctx.emit('notification', {
          title: 'dogecloud 认证失败',
          body: err.message
        })
        throw err
      }
    }

    // 执行上传
    try {
      const { accessKeyId, secretAccessKey, sessionToken } = tokenData.credentials
      const client = uploader.createS3Client(
        accessKeyId,
        secretAccessKey,
        sessionToken,
        tokenData.s3Endpoint
      )

      const tasks = ctx.output.map((item, idx) =>
        uploader.createUploadTask(
          client,
          userConfig.bucketName,
          formatPath(item, userConfig.uploadPath),
          item,
          idx,
          tokenData.s3Endpoint
        )
      )

      const results = await Promise.all(tasks)
      results.forEach((result, index) => {
        const { imgURL } = result
        const baseUrl = `${userConfig.urlPrefix}/${imgURL}`
        const fullUrl = userConfig.urlSuffix ? `${baseUrl}${userConfig.urlSuffix}` : baseUrl
        
        delete ctx.output[index].buffer
        delete ctx.output[index].base64Image
        ctx.output[index].url = fullUrl
        ctx.output[index].imgUrl = fullUrl
      })

      return ctx
    } catch (err) {
      let message = '上传失败'
      if (err.message.includes('Credentials')) {
        message = '凭证无效或已过期'
      } else if (err.message.includes('Bucket')) {
        message = '存储桶不存在或无权访问'
      }
      
      ctx.emit('notification', {
        title: 'dogecloud 上传错误',
        body: `${message}，请检查配置`
      })
      throw err
    }
  }

  const register = () => {
    ctx.helper.uploader.register('dogecloud', {
      handle,
      config,
      name: 'Dogecloud'
    })
  }

  return {
    uploader: 'dogecloud',
    register
  }
}
