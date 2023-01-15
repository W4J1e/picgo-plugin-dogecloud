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
  forceRefreshToken?: boolean
}

export = (ctx: IPicGo) => {
  const getTokenStruct = (accessKey: string, secretKey: string, _bucket: string): IOldReqOptionsWithJSON => {
    let bucketName = _bucket.split('-').slice(3, -1).join('-')
    let bodyJSON = JSON.stringify({
      channel: 'OSS_UPLOAD',
      scopes: [bucketName + ':' + '*'] // 在_bucket位置上报错，这里用的是name，不是s3bucket,uploadpath是规则写法，不是对应位置
    })
    let apiUrl = '/auth/tmp_token.json' // 此 tmp_token API 的文档：https://docs.dogecloud.com/oss/api-tmp-token
    let signStr = apiUrl + '\n' + bodyJSON
    let sign = crypto.createHmac('sha1', secretKey).update(Buffer.from(signStr, 'utf8')).digest('hex')
    let authorization = 'TOKEN ' + accessKey + ':' + sign
    let Url = 'https://api.dogecloud.com' + apiUrl
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
      },
      {
        name: 'forceRefreshToken',
        type: 'confirm',
        default: userConfig.forceRefreshToken || false,
        message: '强制刷新认证Token',
        required: false,
        alias: 'forceRefreshToken'
      }
    ]
  }

  const handle = async (ctx: IPicGo) => {

    let userConfig: IS3UserConfig = ctx.getConfig('picBed.dogecloud')
    if (!userConfig) {
      throw new Error("Can't find dogecloud uploader config")
    }
    if (userConfig.urlPrefix) {
      userConfig.urlPrefix = userConfig.urlPrefix.replace(/\/?$/, '')
    }

    let refreshToken: boolean

    if (!fs.existsSync('./token.json')) {// 如果不存在token，将强制写入。
      refreshToken = true
    } else {
      refreshToken = userConfig.forceRefreshToken
    }

    let ret = {}
    let needGet = true
    // 开始判断是否需要更新token
    if (fs.existsSync('./token.json')) {
      let diff = (fs.statSync('./token.json').mtimeMs - Date.now()) / 1000
      ret = JSON.parse(fs.readFileSync('./token.json', 'utf-8').toString())

      if (ret && diff <= 7000 && ret['s3Bucket'] === userConfig.bucketName && refreshToken) {
        needGet = false
      }
    }

    if (needGet) {
      const tokenResponse: any = await ctx.request(getTokenStruct(userConfig.AccessKey, userConfig.SecretKey, userConfig.bucketName))

      if (tokenResponse.code !== 200) {
        ctx.log.info('===Start dogecloud error report===')
        ctx.log.error('获取 token 失败，参考错误：')
        ctx.log.error(tokenResponse.err_code)
        ctx.log.error(tokenResponse.msg)
        ctx.emit('notification', {
          title: 'dogecloud 上传错误',
          body: '获取 token 失败，无法继续上传。'
        })
        ctx.log.info('===End dogecloud error report===')
      } else {
        let body = tokenResponse.data
        let targetBuckets = body.Buckets.filter(fp => fp.s3Bucket === userConfig.bucketName)
        ret = {
          credentials: body.Credentials,
          s3Bucket: targetBuckets[0].s3Bucket,
          s3Endpoint: targetBuckets[0].s3Endpoint
        }
      }

      if (ret) {
        // 如果没有获取到临时配置，那么停止上传尝试。
        try {
          fs.writeFileSync('./token.json', JSON.stringify(ret))
        } catch (err) {
          ctx.log.error('dogecloud 创建新的文件 token 失败。')
        }

        let ak = ret['credentials']['accessKeyId']
        let ck = ret['credentials']['secretAccessKey']
        let stk = ret['credentials']['sessionToken']
        let edp = ret['s3Endpoint']
        let bk = ret['s3Bucket']
        const client = uploader.createS3Client(
          ak,
          ck,
          stk,
          edp
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
            const {index, url, imgURL} = result

            delete output[index].buffer
            delete output[index].base64Image
            output[index].url = url
            output[index].imgUrl = url

            if (userConfig.urlSuffix) {
              output[index].url = `${userConfig.urlPrefix}/${imgURL}${userConfig.urlSuffix}`
              output[index].imgUrl = `${userConfig.urlPrefix}/${imgURL}${userConfig.urlSuffix}`
            } else {
              output[index].url = `${userConfig.urlPrefix}/${imgURL}`
              output[index].imgUrl = `${userConfig.urlPrefix}/${imgURL}`
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

