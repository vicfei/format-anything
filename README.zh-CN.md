# format-anything —— 任意文件格式逆向，往返校验为证

所有"这文件里是什么？"的工具都返回你必须选择相信的分析。
**format-anything 返回一个可证明的解析器**：agent 研究你的样本、起草可执行
schema，引擎跑唯一要紧的地面真值——**解码样本、重新编码、逐字节比对**。
往返成功 = `verified-byte-equal` 知识；接近成功的，精确声明容差；不行的，
可见地盖上 `hypothesis` 印，绝不伪装成事实。

**格式只有往返成功才算被逆向。**

- 📐 **FORMAT.md**——文件格式知识文档的开放规范（v0，先于引擎立旗）：
  [docs/FORMAT.md](docs/FORMAT.md)（英文）
- 🗺️ 项目规划（2026 逆向浪潮参战车，以验证差异化）：
  [docs/plan-v1.md](docs/plan-v1.md)（英文）

[English](README.md) | 简体中文

## 流水线

```
样本 + 上下文 → 观察 → 假设（任意 LLM，本地友好）
  → 起草 spec → 编译 codec → 往返校验门 → FORMAT.md 报告
                                ├─ 字节相等   → 已验证知识
                                ├─ 容差命中   → semantic-equal，精确声明
                                └─ 不匹配     → 诊断 → agent 自愈重试
```

## 状态

S1 完成（章程 + FORMAT.md 规范 v0 + 名称锁定）。V1 引擎规划中——见
[ROADMAP.md](ROADMAP.md)。

与 [Kaitai Struct](https://github.com/kaitai-io/kaitai_struct)（已知格式、
人写规范）互补——我们发现未知格式并证明之；`.ksy` 互操作已列入计划。
灵感来自逆向浪潮（rea / craft-anything / rea-video），验证纪律承自
[factor-auth](https://github.com/vicfei/dsh-factor-auth) 血统。MIT。
