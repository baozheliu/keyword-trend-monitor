# ALGORITHM_SOURCES

本文档记录 Keyword Watch 中每个算法的来源、许可证、参考实现、测试来源以及与上游的差异。
所有算法均在本地运行并随扩展打包，不加载任何远程代码。

## 依赖库

| 库 | 版本 | 许可证 | 用途 |
| --- | --- | --- | --- |
| [simple-statistics](https://github.com/simple-statistics/simple-statistics) | 7.9.3（npm 发行包，随扩展打包） | ISC | 均值、中位数、MAD、IQR、分位数、标准差、线性回归（趋势斜率） |

simple-statistics 以 npm 包形式直接调用（未复制源码），封装于 `src/core/stats/basic.ts`。
封装差异：空数组返回 `null` 而不是抛异常（上游会 throw），因为真实抓取序列常出现空的有效值集合。

**测试来源**：`tests/unit/stats-basic.test.ts` 复现了上游测试套件（`test/median.test.js`、`test/mad.test.js`、
`test/interquartile_range.test.js`、`test/quantile.test.js`，ISC 许可）中的同输入/同期望断言，
并叠加了空数组、单点、常量、负值、极端值（1e12）用例。浮点断言精度为 1e-9（`toBeCloseTo(…, 9)`）。

## 自实现算法（TypeScript，无上游代码复制）

以下算法均依据公开论文 / 教科书式描述独立实现，未复制、修改或翻译任何上游源码，
因此不受上游代码许可证约束；仍在此注明算法出处。

| 算法 | 文件 | 参考来源 | 与参考实现的差异 |
| --- | --- | --- | --- |
| 稳健异常分数（Median/MAD z-score） | `src/core/stats/robust.ts` | Iglewicz & Hoaglin, *How to Detect and Handle Outliers* (1993), modified z-score | MAD 为 0 时回退 IQR；仍为 0 时用基线水平 5% 的下限刻度，使常量序列上的尖峰可检测；分数截断到 ±50 |
| EWMA 平滑与控制图 | `src/core/stats/ewma.ts` | Roberts (1959)；NIST/SEMATECH e-Handbook §6.3.2.4 | 缺失值跳过且不衰减；使用渐近控制限 σ·√(α/(2−α))；σ=0 时用 5% 下限刻度 |
| CUSUM（表格式，单侧×2） | `src/core/stats/cusum.ts` | Page (1954)；NIST/SEMATECH e-Handbook §6.3.2.3 | 标准化后累计（k=0.5，判定门限 h=5，由调用方比较）；缺失值跳过 |
| 移动平均 | `src/core/stats/movingAverage.ts` | 教科书定义 | 窗口内有效点不足 `minValid` 时输出 `null`，缺失值绝不按 0 计 |
| 连续涨跌计数 | `src/core/stats/streaks.ts` | 常规定义 | 缺失值跳过且不打断连涨/连跌；持平打断 |
| 短长均线交叉 | `src/core/stats/crossover.ts` | 常规金叉/死叉定义（MA7 × MA28） | 仅在最近 `lookback` 天内发生且当前关系仍保持时判定为交叉 |
| 变点检测（均值漂移） | `src/core/stats/changepoint.ts` | Killick, Fearnhead & Eckley, *Optimal detection of changepoints with a linear computational cost*, JASA 107(500), 2012（PELT 伪代码） | L2 段代价 + BIC 型惩罚（3·σ²·ln n，σ 取一阶差分的稳健刻度/√2）；最小段长可配；仅对有效值序列检测 |
| 算法投票 / 告警恢复 / 去重 | `src/core/detect/*.ts` | 产品规则（本项目原创） | 触发分数归一化为“1.0 = 阈值”；连续 3 个新数据点低于阈值 60% 恢复；方向纳入状态键使反转成为新告警 |

## 关于 Grafana Augurs

产品规范优先建议使用 [Grafana Augurs](https://github.com/grafana/augurs)（Apache-2.0）的本地 WASM
绑定做异常/季节性/变点检测。本版本未引入该依赖，原因：

1. MV3 Service Worker 中打包并初始化 wasm-bindgen 产物需要额外的 CSP（`wasm-unsafe-eval`）与
   构建管线配置，增大审核面；
2. 规范同时要求“高级模块不可用时基础算法仍应正常运行”，因此变点检测按 PELT 论文独立实现为
   纯 TypeScript（见上表），全部检测能力不依赖 WASM。

未复制或翻译 Augurs 源码。后续如引入，将以独立打包的 WASM 模块 + 特性开关方式接入，并在本文件补充
版本、commit 与许可证信息。

## 数据获取方式（非算法，但涉及公开知识来源）

- **百度指数**：`src/data/baidu.ts` 调用 index.baidu.com 网页版自身的
  `api/SearchApi/index` 与 `Interface/ptbk` 接口，替换式解密（密钥前半→后半字符映射）为社区广泛
  公开的知识（如 longxiaofei/spider-BaiduIndex 等项目的文档描述）。本实现为独立编写的 TypeScript，
  未复制上述项目代码；地区编码表（省份/城市数字编码）为公开数据。
- **百度指数反爬 Cipher-Text 令牌**：`src/data/baiduCipher.ts`。自 2023 年起 `SearchApi/index`
  对缺少 `Cipher-Text` 请求头的调用返回 `status: 10018`（"疑似异常访问"），即使已登录也无法取数。
  令牌格式为 `<脚本时间戳>_<客户端时间戳>_<base64(AES-128-CBC 密文)>`，明文为
  `{ua, url, platform, clientTs, version}` 的 JSON，密钥 `goqwgaiiacaykuwo`、IV `1234567887654321`。
  该格式的逆向来源为 **longxiaofei/spider-BaiduIndex**（`qdata/baidu_index/common.py` 的
  `get_cipher_text`，**MIT License**，Copyright (c) 2022 龙豆丁）。本项目仅参考其算法说明，使用
  Web Crypto（`crypto.subtle`）独立实现为 TypeScript，未复制原 Python 源码；MIT 许可证允许在保留版权
  声明的前提下参考与再实现，此处已注明出处与许可证。脚本内写死的下位时间戳常量来自百度 `acs-2057.js`，
  百度更新脚本时可能需要同步更新（见文件内注释）。

**Cipher-Text 测试与验证**：`tests/unit/baidu-cipher.test.ts` 校验令牌结构，并用同密钥/IV 解密回明文，
断言 `ua/url/platform/clientTs/version` 字段正确、令牌随请求时间变化。此外通过一次性脚本在真实浏览器中
携带真实登录 Cookie 走完整链路（Cipher-Text → SearchApi → ptbk → 解密），确认返回真实指数数值
（status=0，得到形如 `369,351,359,407,…` 的每日数据）。
- **Google Trends**：`src/data/google.ts` 调用 trends.google.com 公开的
  `trends/api/explore` 与 `trends/api/widgetdata/multiline` 接口（与 pytrends 同一公开流程，独立实现），
  去除 `)]}'` 反劫持前缀后解析 JSON。不需要登录或 API Key。

## 测试与回测

- 单元测试：`tests/unit/`（66+ 项）覆盖空数组、单点、常量、零值、负值、缺失、重复日期、极端值、长序列。
- 回测：`tests/backtest/` 采用严格时间顺序推进（walk-forward），无随机打乱、无未来数据泄漏；
  场景覆盖平稳、周期、尖峰、持续上升、阶跃、反转、异常下降、剧烈波动、缺失、零值、长期不更新；
  百度型（千级整数）与 Google 型（0–100 整数）两种数据形态分别统计。
- 浏览器环境测试：`tests/e2e/extension.test.ts` 将构建产物加载进真实 Chromium（Edge）验证
  Service Worker、存储、弹窗渲染与端到端告警产生。
