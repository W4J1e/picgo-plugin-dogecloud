## picgo-plugin-dogecloud

[PicGo](https://github.com/PicGo/PicGo-Core) 多吉云(dogecloud)上传插件。支持 PicGo GUI 。

### 说明

多吉云(dogecloud)云存储使用的是腾讯云COS或阿里云OSS作为存储空间的底层服务，支持AWS S3 SDK上传。由于并非自家开发的底层存储服务，所以相较于通用的AWS S3 SDK上传，要多传输一个临时`sessionToken`。而现有的[picgo-plugin-s3](https://github.com/wayjam/picgo-plugin-s3)无法直接使用，因此拿来小小改了一下，感谢开发者[wayjam](https://github.com/wayjam)。

关于此插件的详细说明可见[《PicGo插件：上传到多吉云存储》](https://hin.cool/posts/picgoplugin.html)。

### 获取配置信息

Dogecloud关于云存储的文档相当详细，并且提供了一些[现成的代码示例](https://docs.dogecloud.com/oss/manual-tmp-token)以供用户获取密钥。

文档解释，临时密钥由`accessKeyId` `secretAccessKey` `sessionToken`三个字段组成，最长 2 小时有效期，如有其它需求，可以用 Redis 缓存临时密钥（个人客户端使用意义不大）。

以python获取为例，获取到的信息格式为`json`，包含：`accessKeyId` `secretAccessKey` `sessionToken` `s3Bucket` `s3Endpoint` 和`keyPrefix`，其中，第四五项在云存储控制台的SDK参数也可找到，第六项为请求临时密钥时设定的允许上传的目录。

![dogecloudtoken](https://cdn.hin.cool/pic/s3test/dogecloudtoken.jpg)

### 填入配置

| Key               | 说明                          | 例子                               |
| ----------------- | ----------------------------- | ---------------------------------- |
| `accessKeyID`     | 多吉云凭证 ID                   |                                    |
| `secretAccessKey` | 多吉云凭证密钥                  |                                    |
| `sessionToken` | 多吉云临时会话令牌 | |
| `bucketName`      | 多吉云存储桶名称                | `s-gz-2384-xxxxxxx`                   |
| `uploadPath`      | 上传路径                      | `{year}/{month}/{fullName}`        |
| `urlPrefix`       | 最终生成图片 URL 的自定义前缀 | `https://img.example.com/` |
| `endpoint`        | 指定自定义终端节点            | `https://cos.ap-guangzhou.myqcloud.com`       |

**上传路径支持 payload：**

| payload      | 描述                   |
| ------------ | ---------------------- |
| `{year}`     | 当前日期 - 年          |
| `{month}`    | 当前日期 - 月          |
| `{day}`      | 当前日期 - 日          |
| `{fullName}` | 完整文件名（含扩展名） |
| `{fileName}` | 文件名（不含扩展名）   |
| `{extName}`  | 扩展名（不含`.`）      |
| `{md5}`      | 图片 MD5 计算值        |
| `{sha1}`     | 图片 SHA1 计算值       |
| `{sha256}`   | 图片 SHA256 计算值     |

### 示例

GUI端配置参考上方“配置”，忽略此项。

```json
    "dogecloud": {
      "accessKeyID": "xxx",
      "secretAccessKey": "xxxxx",
      "sessionToken": "xxxxx",
      "bucketName": "s-gz-2384-xxxxxxx",
      "uploadPath": "{year}/{md5}.{extName}",
      "endpoint": "https://cos.ap-guangzhou.myqcloud.com",
      "urlPrefix": "https://img.example.com/"
    }
```

如果 PicGo 像以上配置，执行上传：`picgo upload sample.png`，则最终得到图片地址为：`https://img.example.com/2022/4aa4f41e38817e5fd38ac870f40dbc70.jpg`

## 发布

With the following command, a versioned commit which modifies the `version` of `package.json` would be genereated and pushed to the origin. Github Action will automatically compile this pacakage and publish it to NPM.

```sh
npm run patch
npm run minor
npm run major
```

## 开源许可

Released under the [MIT License](https://github.com/wayjam/picgo-plugin-s3/blob/master/LICENSE).
