import picgo from 'picgo'
import uploader, { IUploadResult } from './uploader'
import { formatPath , dogecloudExecToken} from './utils'
import * as fs from 'fs';


interface IS3UserConfig {
  AccessKey: string
  SecretKey: string
  bucketName: string
  uploadPath: string
  urlPrefix?: string
  urlSuffix?: string
  forceRefreshToken?: boolean
}

export = (ctx: picgo) => {
  const config = (ctx: picgo) => {
    const defaultConfig: IS3UserConfig = {
      AccessKey: '',
      SecretKey: '',
      bucketName: '',
      uploadPath: '{year}/{month}/{md5}.{extName}',
    }
    let userConfig = ctx.getConfig<IS3UserConfig>('picBed.dogecloud')
    userConfig = { ...defaultConfig, ...(userConfig || {}) }
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



  const handle = async (ctx: picgo) => {
    let userConfig: IS3UserConfig = ctx.getConfig('picBed.dogecloud')
    if (!userConfig) {
      throw new Error("Can't find dogecloud uploader config")
    }
    if (userConfig.urlPrefix) {
      userConfig.urlPrefix = userConfig.urlPrefix.replace(/\/?$/, '')
    }
    //添加相关项token
    if(!fs.existsSync('./token.json')){//如果不存在token，将强制写入。
      await dogecloudExecToken(userConfig.AccessKey,userConfig.SecretKey,userConfig.bucketName,true);
    }else{
      await dogecloudExecToken(userConfig.AccessKey,userConfig.SecretKey,userConfig.bucketName,userConfig.forceRefreshToken);

    }
    var f = fs.readFileSync('./token.json','utf-8');
    var tdata = JSON.parse(f.toString());
    console.log(tdata);
    var ak = tdata["credentials"]["accessKeyId"];
    var ck = tdata["credentials"]["secretAccessKey"];
    var stk = tdata["credentials"]["sessionToken"];
    var edp = tdata["s3Endpoint"];
    var bk = tdata["s3Bucket"];
    const client = uploader.createS3Client(
      ak,
      ck,
      stk,
      edp,
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
