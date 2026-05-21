<h1 align="center">GitHub Star List Enhancer</h1>

<p align="center">
  为 GitHub Star List 增加搜索、语言筛选和本地排序能力，让收藏清单更容易管理。
</p>

<p align="center">
  <a href="https://github.com/yoky-lumen/github-star-list-enhancer/stargazers">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/yoky-lumen/github-star-list-enhancer?style=flat-square">
  </a>
  <a href="https://github.com/yoky-lumen/github-star-list-enhancer/network/members">
    <img alt="GitHub forks" src="https://img.shields.io/github/forks/yoky-lumen/github-star-list-enhancer?style=flat-square">
  </a>
  <a href="https://github.com/yoky-lumen/github-star-list-enhancer/issues">
    <img alt="GitHub issues" src="https://img.shields.io/github/issues/yoky-lumen/github-star-list-enhancer?style=flat-square">
  </a>
  <a href="https://github.com/yoky-lumen/github-star-list-enhancer/blob/master/LICENSE">
    <img alt="GitHub license" src="https://img.shields.io/github/license/yoky-lumen/github-star-list-enhancer?style=flat-square">
  </a>
</p>

<p align="center">
  <a href="#安装">安装</a> ·
  <a href="https://greasyfork.org/zh-CN/scripts/579183-github-star-list-%E5%A2%9E%E5%BC%BA%E6%8F%92%E4%BB%B6">Greasy Fork</a> ·
  <a href="#效果预览">效果预览</a> ·
  <a href="#隐私说明">隐私说明</a> ·
  <a href="https://github.com/yoky-lumen/github-star-list-enhancer/issues">反馈问题</a>
</p>

## 项目介绍

GitHub Star List 增强插件是一款面向 GitHub Star List 页面的用户脚本。它会在 Star List 页面注入一个轻量工具栏，支持按关键字搜索、按语言筛选，并按最近收藏、最近活跃、Stars 数进行本地排序。

脚本只处理当前页面已经加载出来的仓库信息，不请求 GitHub API，也不会上传或保存你的数据。

## 功能亮点

| 功能 | 说明 |
| ---- | ---- |
| 关键字搜索 | 在当前 Star List 内快速定位仓库，支持多个关键词组合匹配。 |
| 语言筛选 | 自动读取当前列表中的语言信息，并生成语言筛选菜单。 |
| 本地排序 | 支持 Recently starred、Recently active、Most stars 三种排序方式。 |
| GitHub 风格 UI | 尽量复用 GitHub 原有视觉风格，工具栏不会显得突兀。 |
| 无额外请求 | 基于当前页面 DOM 处理，不主动请求 GitHub API。 |

## 安装

### 1. 安装用户脚本管理器

| 浏览器类型 | 推荐脚本管理器 |
| ---- | ---- |
| Chrome / Chromium 内核 | [Tampermonkey][tm-chrome] |
| Firefox / Gecko 内核 | [Tampermonkey][tm-firefox] |

### 2. 安装脚本

| 安装方式 | 链接 | 说明 |
| ---- | ---- | ---- |
| Greasy Fork | [Greasy Fork 页面][greasyfork-url] | 推荐方式，可查看源码、版本信息并通过脚本管理器安装。 |
| GitHub Raw | [安装脚本][script-raw-url] | 适合发布前测试或手动安装。 |
| 手动下载 | [查看源码][script-source-url] | 下载 `github-star-list-enhancer.user.js` 后添加到 Tampermonkey。 |

## 效果预览

### 搜索与工具栏

![搜索与工具栏](assets/img/preview-1.png)

### 语言筛选

![语言筛选](assets/img/preview-2.png)

### 排序菜单

![排序菜单](assets/img/preview-3.png)

## 适用场景

- 你的 Star 仓库很多，翻找成本高。
- 你习惯用 Star List 管理学习清单、工具清单或待研究项目。
- 你想快速对比同一清单内项目的热度与活跃度。
- 你不想为了简单筛选额外授权第三方服务读取 GitHub 数据。

## 兼容性

| 项目 | 状态 |
| ---- | ---- |
| GitHub Star List | 支持 `https://github.com/stars/*/lists/*` |
| Greasy Fork | 已发布，中文区可搜索 |
| Tampermonkey | 推荐 |
| Chrome / Chromium | 支持 |
| Firefox | 支持 |

## 隐私说明

本脚本不会收集、上传或存储你的 GitHub 数据。所有搜索、筛选和排序都在浏览器本地完成，数据来源仅限当前页面已经渲染出来的仓库卡片。

脚本权限为 `@grant none`，仅匹配 `https://github.com/stars/*/lists/*` 页面。

## 已知限制

- 只处理当前页面已经加载的仓库，不会跨分页抓取完整 Star List。
- 不会主动请求 GitHub API，因此排序结果依赖页面上已有的信息。
- 如果 GitHub 调整 Star List 页面结构，部分选择器可能需要同步适配。

## 项目统计

<a href="https://www.star-history.com/?type=timeline&repos=yoky-lumen/github-star-list-enhancer">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=yoky-lumen/github-star-list-enhancer&type=timeline&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=yoky-lumen/github-star-list-enhancer&type=timeline&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=yoky-lumen/github-star-list-enhancer&type=timeline&legend=top-left" />
 </picture>
</a>

## 贡献

欢迎提交 Issue 或 PR：

- Bug 反馈：页面结构变更、筛选异常、排序不准确。
- 功能建议：你在管理 Star List 时最需要的能力。
- 兼容性反馈：不同浏览器或脚本管理器下的表现差异。

## 赞赏

如果这个脚本帮你省了一点整理 Star List 的时间，也欢迎请我喝杯咖啡。

| 微信赞赏 | 支付宝赞赏 |
| ---- | ---- |
| <img src="assets/img/Payment-1.jpg" width="200" /><br><small>喝点咖啡继续干</small> | <img src="assets/img/Payment-2.jpg" width="200" /><br><small>来包辣条吧</small> |

[tm-chrome]: https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo
[tm-firefox]: https://addons.mozilla.org/firefox/addon/tampermonkey/
[greasyfork-url]: https://greasyfork.org/zh-CN/scripts/579183-github-star-list-%E5%A2%9E%E5%BC%BA%E6%8F%92%E4%BB%B6
[script-raw-url]: https://raw.githubusercontent.com/yoky-lumen/github-star-list-enhancer/master/github-star-list-enhancer.user.js
[script-source-url]: https://github.com/yoky-lumen/github-star-list-enhancer/blob/master/github-star-list-enhancer.user.js
