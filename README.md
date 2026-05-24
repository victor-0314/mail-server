# FDM 售后工单系统 - 邮件中转服务

## 功能
通过 IMAP 协议读取网易灵犀企业邮箱，为工单系统提供邮件列表和正文接口。

## 部署到 Vercel（免费）

### 1. 注册 Vercel
前往 https://vercel.com 注册账号（用 GitHub 登录最方便）

### 2. 安装 Vercel CLI
```bash
npm install -g vercel
```

### 3. 部署
```bash
cd fdm-mail-server
vercel
```
按提示操作，完成后会得到一个地址，例如：
`https://fdm-mail-server-xxx.vercel.app`

### 4. 配置工单系统
在工单系统「设置」→「邮箱设置」中填入：
- IMAP 服务器：`imaphz.qiye.163.com`
- 端口：`993`
- 邮箱账号：你的企业邮箱
- 授权密码：在邮箱设置里生成的客户端授权码
- 后端地址：`https://你的vercel域名/api/emails`

## API 接口

### 获取邮件列表
```
POST /api/emails
{
  "host": "imaphz.qiye.163.com",
  "port": 993,
  "user": "you@company.com",
  "password": "授权码",
  "count": 20
}
```

### 获取单封邮件正文
```
POST /api/emails
{
  "host": "imaphz.qiye.163.com",
  "port": 993,
  "user": "you@company.com",
  "password": "授权码",
  "action": "fetch",
  "uid": 12345
}
```

## 网易企业邮箱开启客户端授权码
1. 登录企业邮箱网页版
2. 设置 → 客户端设置 → 开启客户端授权码
3. 生成授权码（注意保存）
4. IMAP 服务器地址：`imaphz.qiye.163.com`，端口 `993`
