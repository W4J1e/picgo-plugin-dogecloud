## picgo-plugin-dogecloud

[PicGo](https://github.com/PicGo/PicGo-Core) 多吉云(dogecloud)上传插件。支持 PicGo GUI 。

## 说明

多吉云(dogecloud)云存储使用的是腾讯云COS或阿里云OSS作为存储空间的底层服务，支持AWS S3 SDK上传。由于使用别家的底层存储服务，所以相较于通用的AWS S3 SDK上传，要多传输一个临时`sessionToken`，所以现有的[picgo-plugin-s3](https://github.com/wayjam/picgo-plugin-s3)无法直接使用，因此拿来小小改了一下，感谢开发者[wayjam](https://github.com/wayjam)。

**目前是简单修改和完善阶段，本地测试可用，但尚未提交到picgo插件库，所以不建议下载使用！**

**目前是简单修改和完善阶段，本地测试可用，但尚未提交到picgo插件库，所以不建议下载使用！**

**目前是简单修改和完善阶段，本地测试可用，但尚未提交到picgo插件库，所以不建议下载使用！**

## 以下文档等待完善。

### 配置 Configuration

```sh
picgo set uploader aws-s3
```

| Key               | 说明                          | 例子                               |
| ----------------- | ----------------------------- | ---------------------------------- |
| `accessKeyID`     | AWS 凭证 ID                   |                                    |
| `secretAccessKey` | AWS 凭证密钥                  |                                    |
| `sessionToken` | 多吉云临时会话令牌 | |
| `bucketName`      | S3 桶名称                     | `s-gz-2384-xx`                          |
| `uploadPath`      | 上传路径                      | `{year}/{month}/{fullName}`        |
| `urlPrefix`       | 最终生成图片 URL 的自定义前缀 | `https://img.example.com/my-blog/` |
| `endpoint`        | 指定自定义终端节点            | `https://cos.ap-guangzhou.myqcloud.com`       |
| `acl` | 访问控制列表(无需修改) | 默认为 `public-read` |

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

### 示例 Example

```json
    "aws-s3": {
      "accessKeyID": "xxx",
      "secretAccessKey": "xxxxx",
      "sessionToken": "xxxxx",
      "bucketName": "my-bucket",
      "uploadPath": "{year}/{md5}.{extName}",
      "endpoint": "https://cos.ap-guangzhou.myqcloud.com",
      "urlPrefix": "https://img.example.com/"
    }
```

如果 PicGo 像以上配置，执行上传：`picgo upload sample.png`，则最终得到图片地址为：`https://img.example.com/2021/4aa4f41e38817e5fd38ac870f40dbc70.jpg`

## 发布 Publish

With the following command, a versioned commit which modifies the `version` of `package.json` would be genereated and pushed to the origin. Github Action will automatically compile this pacakage and publish it to NPM.

```sh
npm run patch
npm run minor
npm run major
```

## 贡献 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 许可证 License

Released under the [MIT License](https://github.com/wayjam/picgo-plugin-s3/blob/master/LICENSE).
