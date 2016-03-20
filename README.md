# aws-ec2-created-usertag

## ローカルで試す

### 前準備
* AWSのCredentialsの設定ずみとする。
* 下記のコマンドで必要なモジュールをインストールする。(package.jsonのあるディレクトリで実行)  
`$ npm install`
* input.jsonにテスト用のパラメータを入力する

### 実行

```bash
$ node aws-ec2-created-usertag.js
```

## AWS Lambdaにインストール
### ポリシーの作成

名前は任意。例えばLambdaCreatedUserTagToEC2のように設定する。  
中身は下記のように設定する。

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject"
            ],
            "Resource": [
                "arn:aws:s3:::[CloudTrailのログを保存しているバケット]/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "ec2:CreateTags"
            ],
            "Resource": [
                "*"
            ]
        }
    ]
}
```

## ロールの作成
続いてロールを作成する。

こちらも名前は任意。例えばLambdaCreatedUserTagToEC2Roleのように設定する。
RoleTypeはAWS Lambdaを選択する。  
中身は先ほど作成したロールをアタッチする。例だとLambdaCreatedUserTagToEC2Role。

## Lamda Functionの作成

下記のコマンドを実行する。

```bash
$ npm install
$ zip aws-ec2-created-usertag.zip -r aws-ec2-created-usertag.js log-config.json node_modules
$ aws --region [作成するリージョン名] lambda create-function --function-name EC2CreatedUserTag --zip-file fileb://[Zipファイルへのパス]/aws-ec2-created-usertag.zip --role [上記で作成したロールのRole ARN] --handler aws-ec2-created-usertag.handler --runtime nodejs --timeout 60 --memory-size 128
```

## Event Sourceの設定

AWSのマネジメントコンソール上で、下記を設定しておく。

* Event source type: S3
* Bucket: CloudTrailのログをためているバケット
* Event type: Put
