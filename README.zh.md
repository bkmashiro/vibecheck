# VibeCheck 🔍

> **你的代码库到底有多 AI？**
>
> 你说是自己写的。但 commit 记录不会撒谎。

VibeCheck 分析 git commit 历史中可复核的 AI 辅助信号：明确 AI 署名、同作者提交爆发、修复链和高密度 session。

**[🚀 立即体验 — git-vibe.pages.dev](https://git-vibe.pages.dev)**

> 无需安装，无需 API Key，粘贴仓库地址即可开始。

---

## Badge

在你的 README 里展示你的 vibe 分数（或者耻辱柱）：

### 仓库 Vibe 分数
```markdown
[![Vibe Score](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/repo/OWNER/REPO)](https://git-vibe.pages.dev/r/OWNER/REPO)
```

### 仓库全球排名
```markdown
[![Vibe Rank](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/rank/OWNER/REPO)](https://git-vibe.pages.dev/r/OWNER/REPO)
```

### 你最 vibe 的仓库（个人 Badge）
```markdown
[![Top Vibe Repo](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/user/你的GitHub用户名)](https://git-vibe.pages.dev)
```

**示例**（bkmashiro/redscript）：

[![Vibe Score](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/repo/bkmashiro/redscript)](https://git-vibe.pages.dev/r/bkmashiro/redscript)
[![Vibe Rank](https://img.shields.io/endpoint?url=https://vibecheck-api.dylan-233.workers.dev/badge/rank/bkmashiro/redscript)](https://git-vibe.pages.dev/r/bkmashiro/redscript)

---

## 工作原理

详细算法说明见 [HOW_IT_WORKS.md](./HOW_IT_WORKS.md)。

Vibe Index v2 使用 GitHub 最近 100 条 commit 的**可复核元数据**，输出归一化的 **0–100** 指数，并单独报告样本置信度。它不会读取源码、prompt 或本地 agent 日志。

| 信号 | 证据分 | 分类上限 |
|---|---:|---:|
| 明确 AI 署名 | 每条 +18 | 45 |
| 同作者爆发速度 | +3 / +5 / +8 | 25 |
| 同作者快速连续提交 | +4 | 10 |
| 同作者修复链 | +5 | 10 |
| 高密度持续 session | +4 / +8 | 20 |

算法排除 merge commit，不把普通人类 `Co-Authored-By:` 当成 AI，也不再按仓库总行数直接加分。它是可审计的启发式比较指标，不是作者鉴定或代码质量分。

---

## 技术栈

- **前端**：React + Vite + Tailwind CSS → Cloudflare Pages
- **后端**：Hono on Cloudflare Workers
- **存储**：Cloudflare KV（分析缓存）+ D1 SQLite（排行榜）
- **认证**：GitHub OAuth App
- **数据**：GitHub GraphQL API（单次请求获取 100 条 commit）

---

## 贡献

评分算法故意写得很简单——而且几乎可以肯定有很多有趣的错误。欢迎改进：

**更好的信号检测：**
- 检测 commit message 的 AI 风格（语法过于完美、过度格式化的列表）
- 分析 commit message 长度分布（AI 倾向于写更长的 message）
- 追踪作者一致性（人类和 AI 是否交替？）
- 按文件类型对信号加权（生成代码 vs 手写代码）
- 检测掩盖 vibe session 的 squash commit

**算法改进：**
- 在带标签的仓库（已知 AI vs 已知人类）上训练小分类器
- 用 commit message 嵌入聚类 vibe vs 非 vibe session
- 考虑一天中的时间模式（凌晨 3 点的 commit 很可疑）
- 交叉参考 CI 通过率与 commit 速率

**开放问题：**
- 删除行应该计分吗？把一万行重构成一百行，可以说比 AI 更像人类
- merge commit 应该排除吗？
- 如何处理 AI 生成初始脚手架、人类维护的仓库？

欢迎 PR。如果你有更好的评分思路，开 issue 或者直接实现——算法在 [`worker/src/analyze.ts`](./worker/src/analyze.ts) 里。

---

## 等等，Vibe 那么多真的好吗？

不好。也好。大多数时候：看情况，这才是重点。

**反对 vibe coding 的理由：**

AI 生成的代码产出快，理解慢。当你 4 分钟之内就 vibe 出一个 500 行的模块，通常对自己提交的东西理解不够深。这会带来：

- **维护债务**：没有亲手写的代码，每次碰都要重新学
- **Bug 盲区**：LLM 会自信地生成似是而非的错误实现，快速输出使你在进入生产前很容易漏掉
- **技能退化**：有证据表明，重度 AI 辅助会损害调试直觉和系统设计判断力的培养
- **安全风险**：AI 不知道你的威胁模型。如果你没问安全问题，它会生成功能正常但默认不安全的代码

**支持 vibe coding 的理由：**

速度是真实的竞争优势。一个比竞争对手快 10 倍的小团队会赢——只要代码够用。AI 编码工具真的压缩了"我有个想法"到"它在生产环境里运行"之间的距离。

用好了，它们负责样板代码、搭建结构、提出你没想到的模式、抓住低级 bug。开发者仍然是架构师。

**真正的担忧：**

问题不是用 AI，而是*生成*与*理解*的比例。VibeCheck 的高分与速度相关，而不是理解程度。一个 85 分的仓库，可能是某人深刻理解了 AI 每一行输出的技术杰作，也可能是一堆作者根本无法调试的 AI 输出。

VibeCheck 无法区分这两者。这是故意的——我们测量的是*过程*，而非质量。Badge 是一个话题的引子，不是判决。

真正的问题不是"你用 AI 了吗？"而是"你知道自己的代码库里有什么吗？"

---

## 其他语言

- [English](./README.md)
- [日本語](./README.ja.md)

---

## 许可证

MIT

---

*用 vibe coding 构建 🤖 ——是的，这个讽刺是故意的。*
