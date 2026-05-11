# GitHub Star Lists Enhancer

这是一个用于 GitHub Star Lists 的用户脚本，会在页面中加入筛选栏，支持搜索、语言过滤和本地排序。

## 功能

- 在 Star List 内搜索仓库
- 按编程语言过滤仓库
- 按最近 Star 排序
- 按最近活跃排序
- 按 Star 数排序
- 适用于 `https://github.com/stars/*/lists/*`

## 安装方法

1. 安装任意一个用户脚本管理器：
   - [Tampermonkey](https://www.tampermonkey.net/)
   - [Violentmonkey](https://violentmonkey.github.io/)
2. 打开 [`github-star-lists-enhancer.user.js`](./github-star-lists-enhancer.user.js)。
3. 在脚本管理器里确认安装。

## 使用方法

打开任意 GitHub Star List 页面：

`https://github.com/stars/<user>/lists/<list-name>`

脚本会在仓库列表上方注入一个工具栏，用来做搜索、过滤和排序。

## 文件说明

- `github-star-lists-enhancer.user.js`：主用户脚本
- `README.md`：项目说明
- `LICENSE`：MIT 许可证

## 发布前需要修改

请把 `github-star-lists-enhancer.user.js` 里的这些占位内容换成你自己的：

- `YOUR_GITHUB_USERNAME`
- `YOUR_NAME`

你也可以顺手把 `LICENSE` 里的版权名字改成你自己的。

## 许可证

[MIT](./LICENSE)
