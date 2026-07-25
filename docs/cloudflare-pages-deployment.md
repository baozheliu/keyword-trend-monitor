# Cloudflare Pages 隐私政策部署

项目参数（Keyword Watch）：

- 目录：`privacy-site`
- 入口：`privacy-site/index.html`
- 图标：`privacy-site/assets/icon128.png`
- 项目名：`keyword-watch-privacy`
- 生产 URL：`https://keyword-watch-privacy.pages.dev/`
- 构建命令：留空（Direct Upload / Wrangler 直传）

```bash
npx wrangler pages deploy privacy-site --project-name keyword-watch-privacy
```

部署后校验：

```bash
curl -I https://keyword-watch-privacy.pages.dev/
```

该目录为静态站点，无构建步骤；部署后请匿名访问生产 URL，确认页面与项目内隐私政策一致。
