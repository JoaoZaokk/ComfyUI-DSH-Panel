# ComfyUI - DSH Panel

[English](#english) · [Português](#português) · [中文](#中文)

---

## English

A ComfyUI monitor for [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) (dsh). It adds a **ComfyUI** entry to the left sidebar where you pick one of your ComfyUI servers and follow the running generation, the queue, the history and the workflow graph of each job.

- Finds every ComfyUI running on this machine on its own (ports 8188–8195), and lets you add remote servers from the plugin page.
- The browser never talks to ComfyUI directly. The dsh Host proxies a short allowlist of ComfyUI endpoints under `/comfyui-proxy/<server>/…` behind dsh's own login, so it is not an open relay.
- Only reads and stops: queue, history, jobs, pictures, and interrupting the running job. It does not submit new prompts.
- The interface is in English, Portuguese and Chinese, following dsh's language.

### Install

```bash
git clone https://github.com/JoaoZaokk/ComfyUI-DSH-Panel.git
dsh plugin --profile desktop add ./ComfyUI-DSH-Panel
```

Use `--profile web` for `dsh web` instead of the desktop app. Restart dsh (or reload its window) and the ComfyUI entry appears in the sidebar.

### Configure

Defaults are in `cordis.patch.yml`:

```yaml
servers: []          # extra servers: [{ name: 'Studio', url: 'http://host:8188', headers?: {} }]
discover:            # local discovery; `discover: false` turns it off
  host: 127.0.0.1
  ports: [8188, 8189, 8190, 8191, 8192, 8193, 8194, 8195]
```

Servers added in the plugin page are saved by the Host in `<DSH home>/comfyui-panel.json` with mode 0600, because they may carry an `Authorization` header.

### Proxy routes

| Route | What |
| --- | --- |
| `GET /comfyui-proxy/_servers` | Known servers and whether each is online |
| `GET /comfyui-proxy/<id>/system_stats`, `queue`, `history`, `history/<id>`, `api/jobs`, `api/jobs/<id>`, `view`, `prompt` | Passed to ComfyUI |
| `POST /comfyui-proxy/<id>/queue`, `interrupt` | Clear the queue or stop the running job |

---

## Português

Monitor do ComfyUI para o [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh) (dsh). Ele adiciona uma entrada **ComfyUI** na barra lateral esquerda, onde você escolhe um dos seus servidores ComfyUI e acompanha a geração em andamento, a fila, o histórico e o grafo do workflow de cada trabalho.

- Acha sozinho todo ComfyUI rodando nesta máquina (portas 8188–8195), e deixa adicionar servidores remotos na página do plugin.
- O navegador nunca fala direto com o ComfyUI. O Host do dsh repassa uma lista curta de endpoints do ComfyUI em `/comfyui-proxy/<servidor>/…`, atrás do próprio login do dsh, então não vira um proxy aberto.
- Só lê e para: fila, histórico, trabalhos, imagens e interromper o trabalho em andamento. Não envia prompts novos.
- A interface está em inglês, português e chinês, seguindo o idioma do dsh.

### Instalar

```bash
git clone https://github.com/JoaoZaokk/ComfyUI-DSH-Panel.git
dsh plugin --profile desktop add ./ComfyUI-DSH-Panel
```

Use `--profile web` para o `dsh web` em vez do app desktop. Reinicie o dsh (ou recarregue a janela) e a entrada do ComfyUI aparece na barra lateral.

### Configurar

Os padrões ficam em `cordis.patch.yml`:

```yaml
servers: []          # servidores extras: [{ name: 'Studio', url: 'http://host:8188', headers?: {} }]
discover:            # descoberta local; `discover: false` desliga
  host: 127.0.0.1
  ports: [8188, 8189, 8190, 8191, 8192, 8193, 8194, 8195]
```

Os servidores adicionados na página do plugin são salvos pelo Host em `<DSH home>/comfyui-panel.json` com permissão 0600, porque podem ter um cabeçalho `Authorization`.

---

## 中文

适用于 [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh)（dsh）的 ComfyUI 监视器。它在左侧边栏添加一个 **ComfyUI** 入口：选择你的某个 ComfyUI 服务器，查看正在进行的生成、队列、历史记录以及每个任务的工作流图。

- 自动发现本机运行的所有 ComfyUI（端口 8188–8195），也可以在插件页面添加远程服务器。
- 浏览器从不直接连接 ComfyUI。dsh Host 在 `/comfyui-proxy/<服务器>/…` 下代理一小组允许的 ComfyUI 接口，并受 dsh 自身登录保护，不会成为开放代理。
- 只读取和停止：队列、历史、任务、图片，以及中断正在运行的任务。不会提交新的提示词。
- 界面支持英文、葡萄牙文和中文，跟随 dsh 的语言设置。

### 安装

```bash
git clone https://github.com/JoaoZaokk/ComfyUI-DSH-Panel.git
dsh plugin --profile desktop add ./ComfyUI-DSH-Panel
```

如果使用 `dsh web` 而不是桌面应用，请改用 `--profile web`。重启 dsh（或刷新窗口）后，侧边栏会出现 ComfyUI 入口。

### 配置

默认值位于 `cordis.patch.yml`：

```yaml
servers: []          # 额外服务器：[{ name: 'Studio', url: 'http://host:8188', headers?: {} }]
discover:            # 本机自动发现；设为 `discover: false` 可关闭
  host: 127.0.0.1
  ports: [8188, 8189, 8190, 8191, 8192, 8193, 8194, 8195]
```

在插件页面添加的服务器由 Host 保存在 `<DSH home>/comfyui-panel.json`，权限为 0600，因为其中可能包含 `Authorization` 请求头。
