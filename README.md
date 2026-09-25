# mobile · DSH 端手互联手机客户端

React + TypeScript + Vite PWA，可经 Capacitor 打包为 Android/iOS 应用。
**所有 DSH 能力远程调用电脑端**，手机只做展示与传输；UI 复刻电脑端设计 token（`src/ui/tokens.css`）。

## 开发

```bash
cd mobile
npm install
npm run dev        # http://<电脑IP>:5183 （手机浏览器直连同一局域网地址）
```

> PWA 在 https 页面下不能连 `ws://`：局域网调试直接用 `http://<IP>:5183`，
> 或在电脑端开启 TLS 后用 `wss://`。生产建议走原生包（Capacitor）。

## 打包

```bash
npm run build          # 产出 dist/（PWA，可部署到任意静态服务器或由 PC 插件托管）
npx cap add android    # 首次
npm run cap:sync       # 同步 dist → android/ios 工程
npm run cap:android    # 打开 Android Studio / Xcode 继续签名与出包
```

原生包可获得：BLE 配对参数交换、后台重连、系统通知、相机扫码（`BarcodeDetector` 降级）。

## 目录

```
src/
├── main.tsx            入口：主题初始化 · 网络事件
├── app/App.tsx         外壳：底部导航 · 抽屉 · 安全区 · 离线条 · 二次确认
├── app/router.ts       hash 路由
├── ui/tokens.css       设计 token（与电脑端 --dsw-alias-* 同名，亮/暗两套）
├── ui/base.tsx         Button/Card/ListRow/Sheet/Confirm/Empty/Error/Skeleton/Toast/CodeBlock
├── net/protocol.ts     dlp/1 类型（对齐 protocol/envelope.schema.json）
├── net/crypto.ts       WebCrypto：X25519·HKDF·AES-GCM·Ed25519
├── net/link-client.ts  心跳 · 重连 · seq/ack · 离线队列 · 加解密
├── net/discovery.ts    beacon · 扫码 · 蓝牙 · 手动 IP
├── net/useLink.ts      LinkClient ↔ store 粘合
├── state/store.ts      全局状态 + React hook
├── api/rpc.ts          类型化远程调用
└── features/           11 个功能页（会话/对话/模型/文件/任务/日志/插件/历史/通知/设置/账号 + 配对）
```

## 调试技巧

- 连接状态红条显示 error code（见 `docs/02-protocol.md` §8）。
- 离线队列：断网后发消息 → 顶部出现“队列 n/200”；恢复网络自动重发（PC 幂等窗口去重）。
- 二次确认：敏感方法会弹底部确认 Sheet，超时 60s 自动拒绝。
- 电脑端不开时“发现”页为空属正常，使用手动 IP 或配对码。
