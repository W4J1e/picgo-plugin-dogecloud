## picgo-plugin-dogecloud

[PicGo](https://github.com/PicGo/PicGo-Core) 多吉云(dogecloud)上传插件。支持 PicGo GUI 。

多吉云(dogecloud)云存储使用的是腾讯云COS或阿里云OSS作为存储空间的底层服务，支持AWS S3 SDK上传。~~由于并非自家开发的底层存储服务，所以相较于通用的AWS S3 SDK上传，要多传输一个临时`sessionToken`~~。而现有的[picgo-plugin-s3](https://github.com/wayjam/picgo-plugin-s3)无法直接使用，因此拿来小小改了一下，感谢前任开发者[wayjam](https://github.com/wayjam)。

关于此插件的详细说明可见[《PicGo插件：上传到多吉云存储》](https://hin.cool/posts/picgoplugin.html)。

## 特别鸣谢

**特别感谢开发者[@mingxuan](https://github.com/yabostone)对本插件的杰出贡献，从而大大简化了使用本插件的流程。**

## 使用说明

使用本插件的必需条件是，你首先应当创建一个标准存储空间，因为**只有标准存储才支持 SDK 操作**。

1.在[密钥管理](https://console.dogecloud.com/user/keys)页面获取`AccessKey`和`SecretKey`；

2.在`云存储`中选择对应的`空间列表`，点击右侧`SDK参数`，记录`s3Bucket`；

### 填入配置

| Key               | 说明                          | 例子                               |
| ----------------- | ----------------------------- | ---------------------------------- |
| `AccessKey`    | 用户AccessKey      | 1v80b5xxxxx9sc9b0 |
| `SecretKey` | 用户SecretKey   | 6adcaf272xxxxxxxx52f26ddsad244cb |
| `bucketName`      | s3bucket                | `s-gz-2384-xxxxxxx`                   |
| `urlPrefix` | 存储空间绑定的CDN域名 | `https://img.example.com` |
| `uploadPath` | 上传路径                      | `{year}/{month}/{fullName}`        |
| `urlSuffix` | 自定义后缀 | `/shuiyin` |
| `forceRefreshToken` | 是否强制刷新Token |  每天可调用八千次，建议打开|

![填写图示](https://user-images.githubusercontent.com/74824162/161233133-c80757f2-fb5c-4bcf-8134-67eb1b2a8b6b.jpg)

**上传路径为空则默认以原始文件名上传到根目录，如指定目录则必需添加 payload：**

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
      "AccessKey": "xxxxxxx",
      "SecretKey": "xxxxxxxxxxxx",
      "bucketName": "s-gz-2384-xxxxxxx",
      "uploadPath": "{year}/{md5}.{extName}",
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
