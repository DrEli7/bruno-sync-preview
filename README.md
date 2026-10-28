# bruno-sync-preview

**在重新导入 OpenAPI 之前，看清 Bruno 集合里的手写脚本、测试和变量可能损失在哪里。**

Offline replacement-risk preview for Bruno collection JSON. Keep Bruno's importer; review the diff before replacing your collection.

## 为什么做这个

Bruno 已有 OpenAPI 导入和 Sync 功能，本项目不实现另一个 API 客户端、OpenAPI 转换器或同步器。它消费官方生成的 collection JSON，把手写配置的变化汇总成适合代码审查、终端和 CI 的清单，不需要运行请求、启动 Bruno 或连接服务。

**模型是“用候选集合替换当前集合会变化什么”**，不是对 Bruno 各版本 Sync 合并逻辑的模拟。若上游 Sync 保留了某项设置，报告中的风险仍需人工核实。没有宣称能替代官方备份或恢复功能。

## 安装和 30 秒示例

需要 Node.js 22 或更高版本。本项目通过源码使用，尚未发布到 npm。

```sh
git clone https://github.com/DrEli7/bruno-sync-preview.git
cd bruno-sync-preview
npm ci --ignore-scripts
npm run demo
npm test
```

示例全部是合成数据。当前版本包含一个手写测试、一个请求脚本和一个环境；候选版本更改路径并新增请求。报告会标出删除或变化的字段，不会打印它们的值。

## 接入真实工作流

1. 在 Bruno 中将现有集合导出为 **Bruno collection JSON**，保存为 `current.json`。
2. 用你安装的官方 Bruno CLI 将新的 OpenAPI 文档生成到独立 JSON 文件：

```sh
bru import openapi --source api.yml --output-file candidate.json --collection-name "My API"
```

3. 比较两份快照：

```sh
node src/cli.mjs current.json candidate.json
node src/cli.mjs current.json candidate.json --format json
node src/cli.mjs current.json candidate.json --fail-on-risk > review.md
```

工具只读取两个显式文件并写 stdout；不修改输入，不调用网络，不执行脚本。重定向到文件由调用者的 shell 完成。不要重定向到输入文件。

| 退出码 | 含义 |
| --- | --- |
| 0 | 成功生成报告；默认不因为差异失败 |
| 1 | 开启 `--fail-on-risk`，且原有项目/字段被改变或移除 |
| 2 | 参数、JSON 或支持范围错误 |

## 检查范围

- 按 **完整文件夹名称数组 + 请求名称** 精确匹配，避开每次导入会变化的 UID。
- HTTP/GraphQL 请求的方法、URL、脚本、测试、变量、断言、认证、headers、params、body 和文档变化。
- 文件夹继承的 request 设置、collection root、环境和 `brunoConfig` 变化。
- 新增/移除项、请求类型、示例、settings、标签和描述变化。
- 拒绝同路径重名项与不支持的 websocket/gRPC/JS/app 项，防止静默漏检。
- 项目身份不依赖顶层 `uid`、排序号 `seq`、本地 `pathname`、`filename`；仅这些项目元数据未被选入比较。请求值中的同名字段仍严格比较，不会因为叫 `uid` 或 `filename` 就漏掉变化。

报告**不包含任何字段值、URL、认证、脚本或请求正文**。集合中的文件夹/请求名称会出现在报告中，发布报告之前仍应确认这些名称不包含私人信息。

风险计数是有风险的变化记录数，不是唯一请求数。数组顺序变化、嵌套字段的生成 UID 变化可能产生保守的字段风险。改名/移动显示为“移除 + 新增”，不猜测意图。仅比较列出的字段；不支持未知自定义插件字段，也不解析 `.bru` 源目录或 OpenCollection YAML。API 结果和备份压缩包不能作为输入。

## 作为库使用

```js
import { previewSync, toMarkdown } from './src/index.mjs';
const report = previewSync(currentCollection, generatedCollection);
console.log(toMarkdown(report));
```

## 上游与验证

- [Bruno 官方 CLI 导入说明](https://github.com/usebruno/bruno/blob/main/packages/bruno-cli/readme.md)
- [Bruno collection 类型](https://github.com/usebruno/bruno/blob/main/packages/bruno-schema-types/src/collection/collection.ts)
- [Bruno HTTP request 类型](https://github.com/usebruno/bruno/blob/main/packages/bruno-schema-types/src/requests/http.ts)

测试通过官方 `@usebruno/converters` 0.25.0 将小型 OpenAPI 文档真实转换后交给预览器，不只依赖手写 fixture。其他测试覆盖重名、路径碰撞、敏感值不出报告、继承设置、CLI 退出码和输入不变。运行时只使用 Node 标准库；官方转换器只用于兼容性测试。GitHub Actions 配置覆盖 Windows/Linux 与 Node 22/24。

Bruno 是其项目维护者的商标；这是独立社区工具。MIT License。
