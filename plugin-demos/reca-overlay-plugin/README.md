# ReCA `shell.overlay` Plugin Demo

这是一个展示优先的 DeepSeek Harness rc.7 客户端插件原型。它通过官方 additive `shell.overlay` slot，在原生 Harness 会话之上挂载一个可开合、可拖动改宽度的 ReCA Trace 抽屉，不替换 Chat、Trajectory 或 Details。

## 现在能看到什么

- 右下角 ReCA launcher；打开后是固定在右侧的浮动抽屉。
- 实时进度、Plan / Assets / Render / Validate / Concat 阶段轨道。
- Shot / Segment 层级树、运行状态和节点详情。
- Segment 视频缩略、模型、尾帧锚点和 continuity audit 标签。
- 三档宽度和左侧拖拽调宽；关闭后原生 Harness 完全可操作。
- 从当前 Harness 会话的 `reca_create_video` / `reca_start` 工具结果精确提取 `run_id`，经 Harness Connection RPC 每 1.6 秒读取真实轨迹。
- 当前会话尚无 `run_id` 时使用内置 Wukong 数据，并明确显示 `DEMO TRACE`；不会误拿其他会话的“最新运行”。

本目录是独立 npm package，不依赖 toolkit 根包。`lib/client.js` 已提交，是 Harness 所需的 `window.__ModuleLoader__.load({ id, factory })` closure-factory，不要求在目标机器上安装前端构建工具。

## 立即看静态 Demo

```bash
cd plugin-demos/reca-overlay-plugin
npm run demo
```

浏览器打开 <http://127.0.0.1:4172>。这是一个完全静态的 Harness 风格页面；可以点击树节点、关闭/重开抽屉、切换宽度，也可拖动抽屉左缘。

## 构建与最小检查

```bash
cd plugin-demos/reca-overlay-plugin
npm run check
```

构建器只使用 Node 标准库：

1. 将 `src/index.js` 复制为 Host half `lib/index.js`；
2. 将 `src/client.js` 和 `src/client.css` 包进 ModuleLoader factory，生成 `lib/client.js`；
3. 检查 package manifest、Host `apply`、ModuleLoader handoff 和 `shell.overlay` 注册。

## 安装到 Harness rc.7

先生成本地安装包：

```bash
cd plugin-demos/reca-overlay-plugin
npm run check
npm pack
```

将生成的 `reca-demo-dsh-overlay-0.1.0.tgz` 添加到 Web profile。支持 bundle 安装的 Harness CLI 可使用：

```bash
dsh plugin --profile web add ./reca-demo-dsh-overlay-0.1.0.tgz
```

包同时提供两项实际加载所需的配置：

- `package.json` 中的 `dsh.bundle.patch = ./cordis.patch.yml`；
- `cordis.patch.yml` 中插入 `@reca-demo/dsh-overlay` loader row。

如果当前 rc.7 CLI 没有自动合并 bundle patch，可将包安装/链接到 profile 的 `node_modules`，并手动把以下 row 加入 Web profile 的 `cordis.patch.yml`：

```yaml
- insert:
    - id: reca-overlay-demo
      name: '@reca-demo/dsh-overlay'
```

然后完整重启 `dsh web`。客户端包元数据会让 Harness 在 boot manifest 中加入 `/plugins/@reca-demo/dsh-overlay/client.js`。

## 真实数据路径

Overlay 不从浏览器直连 ReCA。它先监听当前 Harness session 的 conversation snapshot，只接受该会话工具结果中的精确 `run_id`，然后调用同一 Harness Connection 上的 `/reca-trace` RPC。共享 adapter 将 Gateway 状态、事件、render plan、audit 与 artifacts 纯规则地归一化成当前 UI 使用的 `nodes / stages / progress`。

```text
current Harness session
  -> reca_create_video tool result: run_id
  -> Harness /reca-trace RPC
  -> deployment-configured ReCA Gateway
  -> normalized snapshot
  -> shell.overlay
```

轮询层本身不调用 LLM；ReCA 在规划或生成视频时仍可能调用模型。ReCA 可以与 Harness 同机、容器内、局域网或远程部署，Overlay 代码不变；由 Host proxy 的 Gateway base URL 决定真实位置。特别是远程 ReCA 不能在浏览器插件里配置成 `127.0.0.1`，否则它指向的是浏览器所在机器。

## 包结构

```text
reca-overlay-plugin/
├── package.json             # ./client export + dsh.client + dsh.bundle.patch
├── cordis.patch.yml         # Web profile loader row
├── src/
│   ├── index.js             # 轻量 Host no-op apply
│   ├── client.js            # slot 注册与 React UI
│   └── client.css           # overlay 样式
├── lib/
│   ├── index.js             # 可直接加载的 Host half
│   └── client.js            # 可直接加载的 closure-factory
├── scripts/                 # 零依赖构建、检查、静态服务
└── demo/                    # 独立 Harness 风格静态展示页
```

## 已知限制

- `shell.overlay` 不参与 Harness 三栏宽度计算，因此抽屉会覆盖右侧部分页面；抽屉之外的原生对话仍保持可见和可点击。这正是该方案与修改 Harness 核心增加 right-rail slot 的区别。
- 本包 Host half 仍为 no-op；真实读取依赖组合中提供 `/reca-trace` 的 Host proxy。Gateway 地址、鉴权与网络可达性由该 proxy 管理，而非浏览器插件。
- 目标契约固定在 `0.1.0-rc.7`；Harness Developer Preview 的后续版本需要重新验证 slot 和 bundle 接口。
- 这是展示原型，只保留了基本的断网回退和响应式宽度，没有做大规模状态恢复、Schema 兼容或 E2E 测试。
