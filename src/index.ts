import picgo from 'picgo'
import uploader, { IUploadResult } from './uploader'
import { formatPath} from './utils'
import * as fs from 'fs';
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





const handle = async (ctx: picgo) => {
  let userConfig: IS3UserConfig = ctx.getConfig('picBed.dogecloud')
  if (!userConfig) {
    throw new Error("Can't find dogecloud uploader config")
  }
  if (userConfig.urlPrefix) {
    userConfig.urlPrefix = userConfig.urlPrefix.replace(/\/?$/, '')
  }

  var refreshToken = false ;

  if(!fs.existsSync('./token.json')){//如果不存在token，将强制写入。
    refreshToken=true;
  }else{
    refreshToken = userConfig.forceRefreshToken;
  }
  const getTokenStruct = (accessKey:string,secretKey:string,_bucket:string) =>{
    var bucket_name = _bucket.split("-")[3]
    var bodyJSON = JSON.stringify({
      channel: 'OSS_UPLOAD',
      scopes: [bucket_name + ':'+'*'] //在_bucket位置上报错，这里用的是name，不是s3bucket,uploadpath是规则写法，不是对应位置
  });
    var apiUrl = '/auth/tmp_token.json'; // 此 tmp_token API 的文档：https://docs.dogecloud.com/oss/api-tmp-token
    var signStr = apiUrl + '\n' + bodyJSON;
    var sign = crypto.createHmac('sha1', secretKey).update(Buffer.from(signStr, 'utf8')).digest('hex');
    var authorization = 'TOKEN ' + accessKey + ':' + sign;  
    var url = 'https://api.dogecloud.com' + apiUrl;
    console.log(url)
    return {
      'method': 'POST',
      'uri': url,
      'headers': {
        'Content-Type': 'application/json',
        'Authorization': authorization
      },
      'body': bodyJSON 
    }
  }
//开始判断是否需要更新token
  try{
    if(fs.existsSync('./token.json')){
      //console.log("文件存在");
      //判断token的时间和是否修改过_bucket
      var fst = fs.statSync('./token.json');
      var fsr = fs.readFileSync('./token.json','utf-8');
      var r = JSON.parse(fsr.toString())
      var r_bucket = r['s3Bucket']
      var diff = (fst.mtimeMs - Date.now())/1000;
      if(userConfig.bucketName == r_bucket){
        var bucketEqual = true;
      }else{
        var bucketEqual = false;
      }

      if(diff >= 7000 || !bucketEqual || refreshToken){
        fs.unlinkSync('./token.json');
        const tokenResponse = await ctx.Request.request(getTokenStruct(userConfig.AccessKey,userConfig.SecretKey,userConfig.bucketName));
        var body = JSON.parse(tokenResponse);
        if (body.code !== 200) { console.log(JSON.stringify({error: 'API Error: ' + body.msg})); } // API 返回错误
        var bdata = body.data;
        var dataBuckets = bdata.Buckets //匹配这个_bucket
        var targetBuckets = dataBuckets.filter(function(fp){return fp.s3Bucket==userConfig.bucketName;})
        var ret = {
            credentials: bdata.Credentials,
            //s3Bucket: data.Buckets[0].s3Bucket, //这里默认了第一个存储桶是值
            //获取的filter仍然是[]格式
            s3Bucket: targetBuckets[0].s3Bucket,
            s3Endpoint : targetBuckets[0].s3Endpoint,
        };
        console.log(JSON.stringify(ret)); // 成功
        fs.writeFileSync('./token.json', JSON.stringify(ret));
      }
    }else{
      const tokenResponse = await ctx.Request.request(getTokenStruct(userConfig.AccessKey,userConfig.SecretKey,userConfig.bucketName));
      console.log(tokenResponse)
      body = JSON.parse(tokenResponse);
      if (body.code !== 200) { console.log(JSON.stringify({error: 'API Error: ' + body.msg})); } // API 返回错误
      var bdata = body.data;
      var dataBuckets = bdata.Buckets //匹配这个_bucket
      var targetBuckets = dataBuckets.filter(function(fp){return fp.s3Bucket==userConfig.bucketName;})
      var ret = {
          credentials: bdata.Credentials,
          //s3Bucket: data.Buckets[0].s3Bucket, //这里默认了第一个存储桶是值
          //获取的filter仍然是[]格式
          s3Bucket: targetBuckets[0].s3Bucket,
          s3Endpoint : targetBuckets[0].s3Endpoint,
      };
      console.log(JSON.stringify(ret)); // 成功
      fs.writeFileSync('./token.json', JSON.stringify(ret));

    }
  }catch(err){
    console.log("创建新的文件token失败。");

  }
  
  try{
    var f = fs.readFileSync('./token.json','utf-8');
    var tdata = JSON.parse(f.toString());
  }catch(err){
    tdata = ret;
  }
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


  module.exports = (ctx) => {
    const register = () => {
      ctx.helper.uploader.register('dogecloud', {
        handle,
        config,
        name: 'Dogecloud'
      })
    }
    return {
      register,
    }
  }