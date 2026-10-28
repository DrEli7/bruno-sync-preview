# Contributing

欢迎提交可复现的问题和小范围改进。请用合成数据提供最小输入、预期输出、Node 版本和复现命令；不要上传真实文档、凭据、环境变量或私人数据。

Run `npm ci --ignore-scripts`, then `npm test` and `npm run demo`. Add regression tests for behavior changes. Keep input files read-only and document unsupported upstream formats explicitly. Do not replace established parsers with ad-hoc parsing code.

Pull requests should explain the user problem, compatibility scope and test evidence. This project is MIT licensed; contributions are accepted under that license.