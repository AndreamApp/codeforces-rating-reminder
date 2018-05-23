# codeforces-rating-reminder

Watching your codeforces rating change.

## Example

![Example](https://github.com/AndreamApp/codeforces-rating-reminder/raw/master/screenshots/example.jpg)

## Get started

```shell
git clone "https://github.com/AndreamApp/codeforces-rating-reminder.git"
cd codeforces-rating-reminder
npm install
```

## Configuration

设置你的邮箱和授权码，用于发送邮件通知。

```shell
vim options.json
{
  "sender_name": "Andream",
  "sender_email": "xxxxxxxxx@qq.com",
  "sender_auth": "xxxxxxxxxxxxxxxx",
  "email_subject": "Codeforces Rating Up Up!",

  "check_period": 60000,
  "headless": false
}
```

设置需要提醒的Codeforces用户，每个用户的rating变化后会发送到对应的邮箱。

```shell
vim reminder.json
{
  "list": [
    {
      "name": "Andream",
      "email": "andreamapp@qq.com"
    },
    {
      "name": "TobyCF",
      "email": "843533628@qq.com"
    }
  ]
}
```

## Run

```shell
node reminder
```

## Lisence

MIT
