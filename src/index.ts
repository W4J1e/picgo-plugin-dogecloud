import picgo from 'picgo'
import uploader, { IUploadResult } from './uploader'
import { formatPath } from './utils'

interface IS3UserConfig {
  accessKeyID: string
  secretAccessKey: string
  sessionToken: string
  bucketName: string
  uploadPath: string
  endpoint?: string
  urlPrefix?: string
  urlSuffix?: string
}

export = (ctx: picgo) => {
  const config = (ctx: picgo) => {
    const defaultConfig: IS3UserConfig = {
      accessKeyID: '',
      secretAccessKey: '',
      sessionToken: '',
      bucketName: '',
      uploadPath: '{year}/{month}/{md5}.{extName}',
    }
    let userConfig = ctx.getConfig<IS3UserConfig>('picBed.dogecloud')
    userConfig = { ...defaultConfig, ...(userConfig || {}) }
    return [
      {
        name: 'accessKeyID',
        type: 'input',
        default: userConfig.accessKeyID,
        required: true,
        message: 'accessKeyId',
        alias: '应用 ID'
      },
      {
        name: 'secretAccessKey',
        type: 'password',
        default: userConfig.secretAccessKey,
        required: true,
        message: 'secretAccessKey',
        alias: '应用密钥'
      },
      {
        name: 'sessionToken',
        type: 'password',
        default: userConfig.sessionToken,
        required: true,
        message: 'sessionToken',
        alias: '会话令牌'
      },       
      {
        name: 'bucketName',
        type: 'input',
        default: userConfig.bucketName,
        required: true,
        alias: '存储桶'
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
        name: 'endpoint',
        type: 'input',
        default: userConfig.endpoint,
        required: true,
        alias: '上传节点'
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

  const handle = async (ctx: picgo) => {
    let userConfig: IS3UserConfig = ctx.getConfig('picBed.dogecloud')
    if (!userConfig) {
      throw new Error("Can't find dogecloud uploader config")
    }
    if (userConfig.urlPrefix) {
      userConfig.urlPrefix = userConfig.urlPrefix.replace(/\/?$/, '')
    }

    const client = uploader.createS3Client(
      userConfig.accessKeyID,
      userConfig.secretAccessKey,
      userConfig.sessionToken,
      userConfig.endpoint,
    )

    const output = ctx.output

    const tasks = output.map((item, idx) =>
      uploader.createUploadTask(
        client,
        userConfig.bucketName,
        formatPath(item, userConfig.uploadPath),
        item,
        idx
      )
    )

    try {
      const results: IUploadResult[] = await Promise.all(tasks)
      for (let result of results) {
        const { index, url, imgURL } = result

        delete output[index].buffer
        delete output[index].base64Image
        output[index].url = url
        output[index].imgUrl = url

        if (userConfig.urlSuffix) {
          output[index].url = `${userConfig.urlPrefix}/${imgURL}${userConfig.urlSuffix}`
          output[index].imgUrl = `${userConfig.urlPrefix}/${imgURL}${userConfig.urlSuffix}`
        }
      }

      return ctx
    } catch (err) {
      ctx.log.error('上传到 dogecloud 发生错误，请检查配置是否正确')
      ctx.log.error(err)
      ctx.emit('notification', {
        title: 'dogecloud 上传错误',
        body: '请检查配置是否正确',
        text: ''
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
    register
  }
}
