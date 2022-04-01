import crypto from 'crypto'
import FileType from 'file-type'
import mime from 'mime'
import { IImgInfo } from 'picgo/dist/src/types'
import picgo from 'picgo'
import * as fs from 'fs';

class FileNameGenerator {
  date: Date
  info: IImgInfo

  static fields = [
    'year',
    'month',
    'day',
    'fullName',
    'fileName',
    'extName',
    'md5',
    'sha1',
    'sha256'
  ]

  constructor (info: IImgInfo) {
    this.date = new Date()
    this.info = info
  }

  public year (): string {
    return `${this.date.getFullYear()}`
  }

  public month (): string {
    return this.date.getMonth() < 9
      ? `0${this.date.getMonth() + 1}`
      : `${this.date.getMonth() + 1}`
  }

  public day (): string {
    return this.date.getDate() < 9
      ? `0${this.date.getDate()}`
      : `${this.date.getDate()}`
  }

  public fullName (): string {
    return this.info.fileName
  }

  public fileName (): string {
    return this.info.fileName.replace(this.info.extname, '')
  }

  public extName (): string {
    return this.info.extname.replace('.', '')
  }

  public md5 (): string {
    return crypto.createHash('md5').update(this.imgBuffer()).digest('hex')
  }

  public sha1 (): string {
    return crypto.createHash('sha1').update(this.imgBuffer()).digest('hex')
  }

  public sha256 (): string {
    return crypto.createHash('sha256').update(this.imgBuffer()).digest('hex')
  }

  private imgBuffer (): string | Buffer {
    return this.info.base64Image
      ? this.info.base64Image
      : this.info.buffer
  }
}

export function formatPath (info: IImgInfo, format?: string): string {
  if (!format) {
    return info.fileName
  }

  const fileNameGenerator = new FileNameGenerator(info)

  let formatPath: string = format

  for (let key of FileNameGenerator.fields) {
    const re = new RegExp(`{${key}}`, 'g')
    formatPath = formatPath.replace(re, fileNameGenerator[key]())
  }

  return formatPath
}

export async function extractInfo(info: IImgInfo): Promise<{
  body?: Buffer
  contentType?: string
  contentEncoding?: string
}> {
  let result: {
    body?: Buffer
    contentType?: string
    contentEncoding?: string
  } = {}

  if (info.base64Image) {
    const body = info.base64Image.replace(/^data:[/\w]+;base64,/, '')
    result.contentType = info.base64Image.match(/[^:]\w+\/[\w-+\d.]+(?=;|,)/)?.[0]
    result.body = Buffer.from(body, 'base64')
    result.contentEncoding = 'base64'
  } else {
    if (info.extname) {
      result.contentType = mime.getType(info.extname)
    }
    result.body = info.buffer
  }

  // fallback to detect from buffer
  if (!result.contentType) {
    const fileType = await FileType.fromBuffer(result.body)
    result.contentType = fileType?.mime
  }

  return result
}

export async function dogecloudExecToken(accessKey:string,secretKey:string,_bucket:string ,force=false){
  function getRet(ret:any){
    fs.writeFileSync('./token.json',ret);

  }
  try{
    if(fs.existsSync('./token.json')){
      //console.log("文件存在");
      //判断token的时间和是否修改过_bucket
      var fst = fs.statSync('./token.json');
      var fsr = fs.readFileSync('./token.json','utf-8');
      var r = JSON.parse(fsr.toString())
      var r_bucket = r['s3Bucket']
      var diff = (fst.mtimeMs - Date.now())/1000;
      if(_bucket == r_bucket){
        var bucketEqual = true;
      }else{
        var bucketEqual = false;
      }

      if(diff >= 7000 || !bucketEqual || force){
        fs.unlinkSync('./token.json');
        await dogecloudAuth(accessKey,secretKey,_bucket,getRet);
      }
    }else{
      await getRet({});
      await dogecloudAuth(accessKey,secretKey,_bucket,getRet);
    }
  }catch(err){
    console.log("创建新的文件token。");
    await dogecloudAuth(accessKey,secretKey,_bucket,getRet);
  }
}


async function dogecloudAuth(accessKey:string,secretKey:string,_bucket:string ,callback) {
  var bucket_name = _bucket.split("-")[3]
  var bodyJSON = JSON.stringify({
      channel: 'OSS_UPLOAD',
      scopes: [bucket_name + ':'+'*'] //在_bucket位置上报错，这里用的是name，不是s3bucket,uploadpath是规则写法，不是对应位置
  });
  var apiUrl = '/auth/tmp_token.json'; // 此 tmp_token API 的文档：https://docs.dogecloud.com/oss/api-tmp-token
  var signStr = apiUrl + '\n' + bodyJSON;
  var sign = crypto.createHmac('sha1', secretKey).update(Buffer.from(signStr, 'utf8')).digest('hex');
  var authorization = 'TOKEN ' + accessKey + ':' + sign;  
  var ctx = new picgo;
  await ctx.Request.request({
      url: 'https://api.dogecloud.com' + apiUrl,
      method: 'POST',
      body: bodyJSON,
      headers: {
          'Content-Type': 'application/json',
          'Authorization': authorization
      }
  }, dogeAnswer);//回调dogeAnswer，此函数内可以获取data值做后续处理。
  function dogeAnswer (err, response, body): any {
    if (err) { console.log('Request Error');} // request 错误
    body = JSON.parse(body);
    if (body.code !== 200) { console.log(JSON.stringify({error: 'API Error: ' + body.msg})); } // API 返回错误
    var bdata = body.data;
    var dataBuckets = bdata.Buckets //匹配这个_bucket
    var targetBuckets = dataBuckets.filter(function(fp){return fp.s3Bucket==_bucket;})
    var ret = {
        credentials: bdata.Credentials,
        //s3Bucket: data.Buckets[0].s3Bucket, //这里默认了第一个存储桶是值
        //获取的filter仍然是[]格式
        s3Bucket: targetBuckets[0].s3Bucket,
        s3Endpoint : targetBuckets[0].s3Endpoint,
    };
    console.log(JSON.stringify(ret)); // 成功
    callback(JSON.stringify(ret));
  }
}
