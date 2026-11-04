/**
 * Browser half of the ComfyUI monitor bundle.
 *
 * Registers a left-sidebar entry plus its main panel. The panel lets the user pick one
 * of the ComfyUI servers known to the Host (see index.js), then follows the running
 * generation, the pending queue, the history and each job's workflow graph by polling
 * the Host proxy (ComfyUI only pushes websocket progress to the submitting client id).
 */
window.__ModuleLoader__.load({
	id: '@local/comfyui-panel',
	factory(require) {
		const React = require('react');
		let createPortal = null;
		try {
			createPortal = require('react-dom').createPortal;
		} catch {
			/* no react-dom: the lightbox renders inline */
		}
		const { useState, useEffect, useMemo, useRef, useCallback } = React;
		const h = React.createElement;

		const NS = 'comfyui-panel';
		const PANEL_ID = 'comfyui';
		const TAB_ID = '@local/comfyui-panel/tab';
		const TAB_KIND = 'comfyui';
		const PHOTOS_TAB_ID = '@local/comfyui-panel/photos';
		const PHOTOS_KIND = 'comfyui-photos';
		const BASE = '/comfyui-proxy';
		const STORE_KEY = 'comfyui-panel.server';
		const JOB_POLL_MS = 2000;
		const STAT_POLL_MS = 5000;
		const SERVER_POLL_MS = 10000;
		const DETAIL_LIMIT = 48;
		const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

		// ---------------------------------------------------------------- locale
		const en = {
			panel: 'ComfyUI',
			openRight: 'Open ComfyUI in the side panel',
			viewer: "Viewer",
			photos: "ComfyUI Photos",
			openPhotos: "Open only the photos in the side panel",
			generating: "Generating…",
			queueMore: "+{n} in queue",
			info: "Info",
			latest: "Latest",
			fillView: "Actual size",
			noPhotosYet: "No photos yet — waiting for the next generation.",
			positive: "Positive prompt",
			negative: "Negative prompt",
			emptyPrompt: "(empty)",
			copy: "Copy",
			copied: "Copied",
			showMore: "Show all",
			showLess: "Show less",
			noInputs: "No inputs",
			usedBy: "Used by",
			failedHere: "failed here",
			clickNodeHint: "Click a node to see what is set in it (prompt text, models, values, images).",
			monitor: "Monitor",
			gallery: "Gallery",
			galleryEmpty: "No generated images yet.",
			galleryCount: "{n} image(s)",
			gallerySize: "Size",
			showTemp: "Show previews (temp)",
			layout_masonry: "Masonry",
			layout_grid: "Grid",
			actualSize: "100%",
			fitView: "Fit",
			openJob: "Open job",
			openOriginal: "Open original",
			download: "Download",
			close: "Close",
			prev: "Previous",
			next: "Next",
			settings: "Settings",
			settingsTitle: "ComfyUI servers",
			settingsLead: "Add the ComfyUI you want to follow: this machine, another PC on your network or a remote host. The Host (not the browser) talks to it, so any address reachable from the DSH machine works.",
			serverName: "Name",
			serverNamePh: "optional, e.g. Workstation",
			serverUrl: "Address (URL)",
			serverAuth: "Authorization header",
			authPlaceholder: "optional, e.g. Bearer <token>",
			authKeep: "saved — type to replace",
			removeAuth: "Remove saved auth",
			addServer: "Add server",
			removeServer: "Remove",
			test: "Test connection",
			testing: "Testing…",
			testOk: "Connected",
			testFail: "Failed",
			noSavedServers: "No servers added yet.",
			configServers: "From the bundle patch (read-only)",
			discoverTitle: "Automatic discovery",
			discoverEnable: "Look for ComfyUI on a host automatically",
			discoverHost: "Host",
			discoverPorts: "Ports",
			discoverNote: "Discovery only lists addresses that answer as a ComfyUI. Ports accept lists and ranges, e.g. 8188-8195, 9000.",
			save: "Save",
			revert: "Revert",
			saved: "Saved.",
			fileNote: "Stored on the DSH Host in {file}.",
			addFirst: "Add a server",
			servers: 'Servers',
			serverOne: 'Server',
			refresh: 'Refresh',
			online: 'online',
			offline: 'offline',
			scanning: 'Looking for ComfyUI servers…',
			noServersTitle: 'No ComfyUI server found',
			noServersBody:
				'Start ComfyUI (default port 8188) or add a server to this plugin config: servers: [{ name, url }]. Local ports 8188–8195 are scanned automatically.',
			rescan: 'Scan again',
			vram: 'VRAM',
			ram: 'RAM',
			running: 'Running',
			pending: 'Queue',
			history: 'History',
			nothingRunning: 'Nothing is generating right now.',
			queueEmpty: 'Queue is empty.',
			historyEmpty: 'No generations yet.',
			elapsed: 'elapsed',
			eta: 'typically {time}',
			stop: 'Stop',
			cancel: 'Remove',
			confirm: 'Sure?',
			graph: 'Workflow',
			nodes: 'Nodes',
			outputs: 'Outputs',
			selectJob: 'Select a job to see its workflow.',
			loadingDetail: 'Loading workflow…',
			noGraph: 'This job has no workflow data.',
			noOutputs: 'No outputs yet.',
			zoomIn: 'Zoom in',
			zoomOut: 'Zoom out',
			zoomFit: 'Reset zoom',
			inspector: 'Inputs of #{id}',
			cached: 'cached',
			failedAt: 'Failed at node #{id} {type}',
			status_completed: 'Done',
			status_failed: 'Failed',
			status_cancelled: 'Cancelled',
			status_in_progress: 'Running',
			status_pending: 'Pending',
			nodesCount: '{n} nodes',
			ago: '{time} ago',
			connError: 'Cannot reach the server: {msg}',
			prompt: 'Prompt',
			model: 'Model',
			sampler: 'Sampler',
			size: 'Size',
			link: 'link',
			position: '#{n} in queue',
		};
		const zh = {
			panel: 'ComfyUI',
			openRight: '在侧边面板中打开 ComfyUI',
			viewer: "查看器",
			photos: "ComfyUI 图片",
			openPhotos: "在侧边面板中仅显示图片",
			generating: "生成中…",
			queueMore: "队列还有 {n} 个",
			info: "信息",
			latest: "最新",
			fillView: "原始大小",
			noPhotosYet: "还没有图片 — 等待下一次生成。",
			positive: "正向提示词",
			negative: "负向提示词",
			emptyPrompt: "（空）",
			copy: "复制",
			copied: "已复制",
			showMore: "展开全部",
			showLess: "收起",
			noInputs: "无输入",
			usedBy: "被使用于",
			failedHere: "此处失败",
			clickNodeHint: "点击节点可查看其中设置的内容（提示词、模型、数值、图片）。",
			monitor: "监控",
			gallery: "图库",
			galleryEmpty: "还没有生成的图片。",
			galleryCount: "{n} 张图片",
			gallerySize: "大小",
			showTemp: "显示预览图（temp）",
			layout_masonry: "瀑布流",
			layout_grid: "网格",
			actualSize: "100%",
			fitView: "适应",
			openJob: "打开任务",
			openOriginal: "打开原图",
			download: "下载",
			close: "关闭",
			prev: "上一张",
			next: "下一张",
			settings: "设置",
			settingsTitle: "ComfyUI 服务器",
			settingsLead: "添加要跟踪的 ComfyUI：本机、局域网内的其他电脑或远程主机。由 Host（而非浏览器）连接，因此只要 DSH 所在机器能访问即可。",
			serverName: "名称",
			serverNamePh: "可选，例如 工作站",
			serverUrl: "地址 (URL)",
			serverAuth: "Authorization 请求头",
			authPlaceholder: "可选，例如 Bearer <token>",
			authKeep: "已保存 — 输入以替换",
			removeAuth: "移除已保存的凭据",
			addServer: "添加服务器",
			removeServer: "删除",
			test: "测试连接",
			testing: "测试中…",
			testOk: "已连接",
			testFail: "失败",
			noSavedServers: "尚未添加服务器。",
			configServers: "来自 bundle patch（只读）",
			discoverTitle: "自动发现",
			discoverEnable: "自动在某台主机上查找 ComfyUI",
			discoverHost: "主机",
			discoverPorts: "端口",
			discoverNote: "自动发现只会列出确实是 ComfyUI 的地址。端口支持列表和范围，例如 8188-8195, 9000。",
			save: "保存",
			revert: "还原",
			saved: "已保存。",
			fileNote: "保存在 DSH Host 的 {file}。",
			addFirst: "添加服务器",
			servers: '服务器',
			serverOne: '服务器',
			refresh: '刷新',
			online: '在线',
			offline: '离线',
			scanning: '正在查找 ComfyUI 服务器…',
			noServersTitle: '未找到 ComfyUI 服务器',
			noServersBody:
				'请启动 ComfyUI(默认端口 8188),或在插件配置中添加服务器:servers: [{ name, url }]。本机 8188–8195 端口会被自动扫描。',
			rescan: '重新扫描',
			vram: '显存',
			ram: '内存',
			running: '运行中',
			pending: '队列',
			history: '历史',
			nothingRunning: '当前没有正在生成的任务。',
			queueEmpty: '队列为空。',
			historyEmpty: '还没有生成记录。',
			elapsed: '已用',
			eta: '通常 {time}',
			stop: '停止',
			cancel: '移除',
			confirm: '确定?',
			graph: '工作流',
			nodes: '节点',
			outputs: '输出',
			selectJob: '选择一个任务以查看其工作流。',
			loadingDetail: '正在加载工作流…',
			noGraph: '该任务没有工作流数据。',
			noOutputs: '暂无输出。',
			zoomIn: '放大',
			zoomOut: '缩小',
			zoomFit: '重置缩放',
			inspector: '节点 #{id} 的输入',
			cached: '已缓存',
			failedAt: '在节点 #{id} {type} 处失败',
			status_completed: '完成',
			status_failed: '失败',
			status_cancelled: '已取消',
			status_in_progress: '运行中',
			status_pending: '等待中',
			nodesCount: '{n} 个节点',
			ago: '{time}前',
			connError: '无法连接服务器:{msg}',
			prompt: '提示词',
			model: '模型',
			sampler: '采样器',
			size: '尺寸',
			link: '连接',
			position: '队列第 {n} 位',
		};
		const pt = {
			panel: 'ComfyUI',
			openRight: 'Abrir o ComfyUI no painel lateral',
			viewer: "Visualizador",
			photos: "Fotos do ComfyUI",
			openPhotos: "Abrir só as fotos no painel lateral",
			generating: "Gerando…",
			queueMore: "+{n} na fila",
			info: "Info",
			latest: "Mais recente",
			fillView: "Tamanho real",
			noPhotosYet: "Nenhuma foto ainda — aguardando a próxima geração.",
			positive: "Prompt positivo",
			negative: "Prompt negativo",
			emptyPrompt: "(vazio)",
			copy: "Copiar",
			copied: "Copiado",
			showMore: "Ver tudo",
			showLess: "Ver menos",
			noInputs: "Sem entradas",
			usedBy: "Usado por",
			failedHere: "falhou aqui",
			clickNodeHint: "Clique num nó para ver o que foi colocado nele (texto do prompt, modelos, valores, imagens).",
			monitor: "Monitor",
			gallery: "Galeria",
			galleryEmpty: "Nenhuma imagem gerada ainda.",
			galleryCount: "{n} imagem(ns)",
			gallerySize: "Tamanho",
			showTemp: "Mostrar previews (temp)",
			layout_masonry: "Mosaico",
			layout_grid: "Grade",
			actualSize: "100%",
			fitView: "Ajustar",
			openJob: "Abrir job",
			openOriginal: "Abrir original",
			download: "Baixar",
			close: "Fechar",
			prev: "Anterior",
			next: "Próxima",
			settings: "Configurações",
			settingsTitle: "Servidores ComfyUI",
			settingsLead: "Adicione o ComfyUI que quer acompanhar: esta máquina, outro PC da rede ou um host remoto. Quem conversa com ele é o Host (não o navegador), então qualquer endereço alcançável a partir da máquina do DSH serve.",
			serverName: "Nome",
			serverNamePh: "opcional, ex.: Workstation",
			serverUrl: "Endereço (URL)",
			serverAuth: "Header Authorization",
			authPlaceholder: "opcional, ex.: Bearer <token>",
			authKeep: "salvo — digite para trocar",
			removeAuth: "Remover auth salva",
			addServer: "Adicionar servidor",
			removeServer: "Remover",
			test: "Testar conexão",
			testing: "Testando…",
			testOk: "Conectado",
			testFail: "Falhou",
			noSavedServers: "Nenhum servidor adicionado ainda.",
			configServers: "Do patch do bundle (somente leitura)",
			discoverTitle: "Descoberta automática",
			discoverEnable: "Procurar ComfyUI automaticamente num host",
			discoverHost: "Host",
			discoverPorts: "Portas",
			discoverNote: "A descoberta só lista endereços que respondem como ComfyUI. Portas aceitam listas e faixas, ex.: 8188-8195, 9000.",
			save: "Salvar",
			revert: "Desfazer",
			saved: "Salvo.",
			fileNote: "Guardado no Host do DSH em {file}.",
			addFirst: "Adicionar servidor",
			servers: 'Servidores',
			serverOne: 'Servidor',
			refresh: 'Atualizar',
			online: 'online',
			offline: 'offline',
			scanning: 'Procurando servidores ComfyUI…',
			noServersTitle: 'Nenhum servidor ComfyUI encontrado',
			noServersBody:
				'Inicie o ComfyUI (porta padrão 8188) ou adicione um servidor na configuração do plugin: servers: [{ name, url }]. As portas locais 8188–8195 são verificadas automaticamente.',
			rescan: 'Procurar de novo',
			vram: 'VRAM',
			ram: 'RAM',
			running: 'Em execução',
			pending: 'Fila',
			history: 'Histórico',
			nothingRunning: 'Nada está sendo gerado agora.',
			queueEmpty: 'A fila está vazia.',
			historyEmpty: 'Nenhuma geração ainda.',
			elapsed: 'decorrido',
			eta: 'normalmente {time}',
			stop: 'Parar',
			cancel: 'Remover',
			confirm: 'Certeza?',
			graph: 'Workflow',
			nodes: 'Nós',
			outputs: 'Saídas',
			selectJob: 'Selecione um trabalho para ver o workflow.',
			loadingDetail: 'Carregando workflow…',
			noGraph: 'Este trabalho não tem dados de workflow.',
			noOutputs: 'Ainda sem saídas.',
			zoomIn: 'Aumentar',
			zoomOut: 'Diminuir',
			zoomFit: 'Zoom padrão',
			inspector: 'Entradas do nó #{id}',
			cached: 'em cache',
			failedAt: 'Falhou no nó #{id} {type}',
			status_completed: 'Concluído',
			status_failed: 'Falhou',
			status_cancelled: 'Cancelado',
			status_in_progress: 'Em execução',
			status_pending: 'Pendente',
			nodesCount: '{n} nós',
			ago: 'há {time}',
			connError: 'Não foi possível acessar o servidor: {msg}',
			prompt: 'Prompt',
			model: 'Modelo',
			sampler: 'Sampler',
			size: 'Tamanho',
			link: 'ligação',
			position: '#{n} na fila',
		};

		let t = (key) => key;
		let subscribeLocale = () => () => {};
		function useLocaleTick() {
			const [, setTick] = useState(0);
			useEffect(() => subscribeLocale(() => setTick((n) => n + 1)), []);
		}

		// --------------------------------------------------------------- helpers
		const enc = encodeURIComponent;
		async function getJson(serverId, path) {
			const response = await fetch(`${BASE}/${enc(serverId)}/${path}`, { credentials: 'same-origin' });
			if (!response.ok) {
				const error = new Error(`HTTP ${response.status}`);
				error.status = response.status;
				throw error;
			}
			return response.json();
		}
		async function postJson(serverId, path, body) {
			const response = await fetch(`${BASE}/${enc(serverId)}/${path}`, {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body ?? {}),
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
		}
		function viewUrl(serverId, file, preview) {
			const q = `filename=${enc(file.filename)}&subfolder=${enc(file.subfolder || '')}&type=${enc(file.type || 'output')}`;
			return `${BASE}/${enc(serverId)}/view?${q}${preview ? '&preview=webp;70' : ''}`;
		}
		function fmtDur(ms) {
			if (!Number.isFinite(ms) || ms < 0) return '–';
			const s = Math.round(ms / 1000);
			if (s < 60) return `${s}s`;
			const m = Math.floor(s / 60);
			if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
			return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
		}
		function fmtBytes(n) {
			if (!Number.isFinite(n)) return '–';
			return `${(n / 1024 ** 3).toFixed(1)} GB`;
		}
		function trunc(text, max) {
			const s = String(text ?? '');
			return s.length > max ? `${s.slice(0, max - 1)}…` : s;
		}
		function isLink(v) {
			return Array.isArray(v) && v.length === 2 && (typeof v[0] === 'string' || typeof v[0] === 'number') && typeof v[1] === 'number';
		}
		function scalar(v) {
			if (isLink(v)) return `← #${v[0]}`;
			if (v === null || v === undefined) return '';
			if (typeof v === 'object') return JSON.stringify(v);
			return String(v);
		}

		// ---- prompt / node-content helpers (API graph: nodeId -> {class_type, inputs, _meta}) ----
		const PROMPT_KEYS = ['text', 'prompt', 'text_g', 'text_l', 'positive_prompt', 'negative_prompt', 'string', 'caption', 'instruction'];
		const COND_LINK = /^conditioning/i;
		const TEXT_LINK = /^(text|prompt|text_g|text_l|string|value|positive_prompt|negative_prompt)$/i;
		const IDENTITY_KEYS = ['ckpt_name', 'unet_name', 'vae_name', 'clip_name', 'lora_name', 'model_name', 'control_net_name', 'image', 'filename_prefix', 'sampler_name'];
		const nodeTitle = (node) => node?._meta?.title || node?.class_type || '?';

		/** The free text a node carries (CLIPTextEncode.text, *.prompt, …); longest wins, empty string kept. */
		function nodeText(node) {
			const inputs = node?.inputs || {};
			let found = null;
			for (const key of PROMPT_KEYS) {
				const value = inputs[key];
				if (typeof value === 'string' && (!found || value.length > found.text.length)) found = { key, text: value };
			}
			return found;
		}
		/** Follow a conditioning/text link upstream until nodes carrying text are found. */
		function resolvePrompt(graph, ref, seen = new Set(), depth = 0) {
			if (!isLink(ref) || depth > 14) return [];
			const id = String(ref[0]);
			const node = graph?.[id];
			if (!node || seen.has(id)) return [];
			seen.add(id);
			const own = nodeText(node);
			const out = [];
			if (own) out.push({ id, type: node.class_type, title: nodeTitle(node), key: own.key, text: own.text });
			for (const [key, value] of Object.entries(node.inputs || {})) {
				if (!isLink(value)) continue;
				if (COND_LINK.test(key) || (!own && TEXT_LINK.test(key))) out.push(...resolvePrompt(graph, value, seen, depth + 1));
			}
			return out;
		}
		/** Positive / negative prompt per sampler (any node with linked `positive` + `negative`). */
		function findPrompts(graph) {
			const groups = [];
			const sigs = new Set();
			const ids = Object.keys(graph || {}).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
			for (const id of ids) {
				const node = graph[id];
				const inputs = node?.inputs || {};
				if (!isLink(inputs.positive) || !isLink(inputs.negative)) continue;
				const positive = resolvePrompt(graph, inputs.positive);
				const negative = resolvePrompt(graph, inputs.negative);
				const sig = JSON.stringify([positive.map((p) => p.id), negative.map((p) => p.id)]);
				if (sigs.has(sig)) continue;
				sigs.add(sig);
				groups.push({ id, title: nodeTitle(node), positive, negative });
			}
			if (!groups.length) {
				const loose = ids
					.map((id) => ({ id, node: graph[id], own: nodeText(graph[id]) }))
					.filter((x) => x.own && x.own.text.trim() && !/filename|save/i.test(x.node.class_type || ''))
					.map((x) => ({ id: x.id, type: x.node.class_type, title: nodeTitle(x.node), key: x.own.key, text: x.own.text }));
				if (loose.length) groups.push({ id: '', title: '', positive: loose, negative: [] });
			}
			return groups;
		}
		/** What a linked-from node "holds": its text, or its model/file name. */
		function sourcePreview(graph, ref) {
			const node = graph?.[String(ref[0])];
			if (!node) return '';
			const own = nodeText(node);
			if (own && own.text) return own.text;
			for (const key of IDENTITY_KEYS) if (typeof node.inputs?.[key] === 'string') return node.inputs[key];
			return '';
		}
		function downstreamOf(graph, id) {
			const out = [];
			for (const [otherId, node] of Object.entries(graph || {})) {
				const via = Object.entries(node.inputs || {}).filter(([, v]) => isLink(v) && String(v[0]) === String(id)).map(([k]) => k);
				if (via.length) out.push({ id: otherId, title: nodeTitle(node), via });
			}
			return out.sort((a, b) => Number(a.id) - Number(b.id));
		}
		/** "name.png [input]" / "sub/name.png" -> /view file descriptor. */
		function parseImageName(value) {
			const m = /^(.*?)(?: \[(input|output|temp)\])?$/.exec(String(value));
			const full = m[1];
			const slash = full.lastIndexOf('/');
			return { filename: slash < 0 ? full : full.slice(slash + 1), subfolder: slash < 0 ? '' : full.slice(0, slash), type: m[2] || 'input' };
		}
		function copyText(text) {
			try {
				if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
			} catch {
				/* fall through */
			}
			const area = document.createElement('textarea');
			area.value = text;
			area.style.position = 'fixed';
			area.style.opacity = '0';
			document.body.appendChild(area);
			area.select();
			try {
				document.execCommand('copy');
			} catch {
				/* ignored */
			}
			area.remove();
			return Promise.resolve();
		}
		function useStored(key, initial) {
			const [value, setValue] = useState(() => {
				try {
					const raw = localStorage.getItem(key);
					return raw === null ? initial : typeof initial === 'number' ? Number(raw) || initial : raw;
				} catch {
					return initial;
				}
			});
			const set = useCallback(
				(next) => {
					setValue(next);
					try {
						localStorage.setItem(key, String(next));
					} catch {
						/* storage unavailable */
					}
				},
				[key],
			);
			return [value, set];
		}

		/** One-line facts about a workflow (API graph: nodeId -> {class_type, inputs}). */
		function summarize(graph) {
			const out = { prompt: undefined, models: [], sampler: undefined, size: undefined };
			for (const node of Object.values(graph || {})) {
				const i = node?.inputs || {};
				if (!out.prompt && /CLIPTextEncode/.test(node.class_type || '') && typeof i.text === 'string' && i.text.trim()) out.prompt = i.text;
				for (const key of ['ckpt_name', 'unet_name', 'model_name']) {
					if (typeof i[key] === 'string' && !out.models.includes(i[key])) out.models.push(i[key]);
				}
				if (!out.sampler && 'steps' in i && 'cfg' in i) {
					const seed = i.seed ?? i.noise_seed;
					out.sampler = [
						typeof i.sampler_name === 'string' ? i.sampler_name : undefined,
						typeof i.steps === 'number' ? `${i.steps} steps` : undefined,
						typeof i.cfg === 'number' ? `cfg ${i.cfg}` : undefined,
						typeof seed === 'number' ? `seed ${seed}` : undefined,
					]
						.filter(Boolean)
						.join(' · ');
				}
				if (!out.size && typeof i.width === 'number' && typeof i.height === 'number' && 'batch_size' in i) out.size = `${i.width}×${i.height}`;
			}
			return out;
		}
		function signature(graph) {
			return Object.values(graph || {})
				.map((n) => n.class_type)
				.sort()
				.join('|');
		}
		function median(values) {
			if (!values.length) return undefined;
			const s = [...values].sort((a, b) => a - b);
			return s[Math.floor(s.length / 2)];
		}

		// ------------------------------------------------------------ job loading
		function normalizeJob(j) {
			return {
				id: j.id,
				status: j.status,
				created: j.create_time,
				start: j.execution_start_time,
				end: j.execution_end_time,
				outputsCount: j.outputs_count || 0,
				preview: j.preview_output,
				error: j.execution_error,
				graph: j.graph,
			};
		}
		async function loadJobs(serverId, mode) {
			if (mode.legacy !== true) {
				try {
					const data = await getJson(serverId, `api/jobs?limit=${DETAIL_LIMIT * 2}`);
					return (Array.isArray(data) ? data : data.jobs || []).map(normalizeJob);
				} catch (error) {
					if (error.status !== 404) throw error;
					mode.legacy = true;
				}
			}
			const [queue, hist] = await Promise.all([getJson(serverId, 'queue'), getJson(serverId, `history?max_items=${DETAIL_LIMIT * 2}`)]);
			const jobs = [];
			for (const it of queue.queue_running || []) jobs.push({ id: it[1], status: 'in_progress', created: it[3]?.create_time, outputsCount: 0, graph: it[2] });
			for (const it of queue.queue_pending || []) jobs.push({ id: it[1], status: 'pending', created: it[3]?.create_time, outputsCount: 0, graph: it[2] });
			const entries = Object.entries(hist).map(([id, e]) => {
				const failed = e.status?.status_str === 'error';
				const first = Object.entries(e.outputs || {}).flatMap(([nodeId, o]) => (o.images || []).map((img) => ({ ...img, nodeId })))[0];
				const msgs = e.status?.messages || [];
				const stamp = (name) => msgs.find((m) => m[0] === name)?.[1]?.timestamp;
				const err = msgs.find((m) => m[0] === 'execution_error')?.[1];
				return {
					id,
					status: failed ? 'failed' : 'completed',
					created: e.prompt?.[3]?.create_time,
					start: stamp('execution_start'),
					end: msgs[msgs.length - 1]?.[1]?.timestamp,
					outputsCount: first ? 1 : 0,
					preview: first,
					error: err,
					graph: e.prompt?.[2],
					outputs: e.outputs,
					messages: msgs,
				};
			});
			entries.sort((a, b) => (b.created || 0) - (a.created || 0));
			return [...jobs, ...entries];
		}
		async function loadDetail(serverId, job, mode) {
			let raw;
			if (job.graph && (mode.legacy || !TERMINAL.has(job.status))) raw = { workflow: { prompt: job.graph }, outputs: job.outputs, execution_status: { messages: job.messages || [] } };
			else raw = await getJson(serverId, `api/jobs/${enc(job.id)}`);
			const messages = raw.execution_status?.messages || [];
			const cachedMsg = messages.find((m) => m[0] === 'execution_cached');
			const errMsg = messages.find((m) => m[0] === 'execution_error');
			const error = raw.execution_error || errMsg?.[1] || job.error;
			return {
				status: job.status,
				graph: raw.workflow?.prompt || job.graph || null,
				outputs: raw.outputs || {},
				cached: new Set((cachedMsg?.[1]?.nodes || []).map(String)),
				error: error ? { node: String(error.node_id ?? ''), type: error.node_type, message: error.exception_message || error.message } : null,
			};
		}

		// ----------------------------------------------------------------- graph
		const NODE_W = 188;
		const NODE_H = 46;
		const GAP_X = 64;
		const GAP_Y = 16;
		function categoryColor(type) {
			const s = String(type || '');
			if (/Loader|Load[A-Z]|Checkpoint|LoRA|UNET/.test(s)) return 'hsl(262 70% 62%)';
			if (/CLIPTextEncode|Conditioning|Prompt|Text/.test(s)) return 'hsl(38 90% 55%)';
			if (/Sampler|Scheduler|Guider|Noise|Sigmas/.test(s)) return 'hsl(214 85% 60%)';
			if (/VAE/.test(s)) return 'hsl(330 70% 62%)';
			if (/Latent/.test(s)) return 'hsl(174 60% 45%)';
			if (/Save|Preview|Output|Video/.test(s)) return 'hsl(142 55% 45%)';
			return 'hsl(220 10% 55%)';
		}
		function layoutGraph(graph) {
			const ids = Object.keys(graph || {});
			const edges = [];
			const incoming = new Map(ids.map((id) => [id, []]));
			for (const id of ids) {
				for (const [name, value] of Object.entries(graph[id]?.inputs || {})) {
					if (isLink(value) && graph[String(value[0])]) {
						const from = String(value[0]);
						edges.push({ from, to: id, name });
						incoming.get(id).push(from);
					}
				}
			}
			const layerOf = new Map();
			const visiting = new Set();
			const layer = (id) => {
				if (layerOf.has(id)) return layerOf.get(id);
				if (visiting.has(id)) return 0;
				visiting.add(id);
				let best = 0;
				for (const from of incoming.get(id)) best = Math.max(best, layer(from) + 1);
				visiting.delete(id);
				layerOf.set(id, best);
				return best;
			};
			ids.forEach(layer);
			const columns = [];
			for (const id of ids) (columns[layerOf.get(id)] ||= []).push(id);
			const rowOf = new Map();
			columns.forEach((col) => col.forEach((id, i) => rowOf.set(id, i)));
			for (let pass = 0; pass < 3; pass += 1) {
				for (let c = 1; c < columns.length; c += 1) {
					const score = (id) => {
						const src = incoming.get(id).filter((from) => layerOf.get(from) < c);
						return src.length ? src.reduce((sum, from) => sum + rowOf.get(from), 0) / src.length : rowOf.get(id);
					};
					columns[c].sort((a, b) => score(a) - score(b));
					columns[c].forEach((id, i) => rowOf.set(id, i));
				}
			}
			const tallest = Math.max(1, ...columns.map((col) => col.length));
			const pos = new Map();
			columns.forEach((col, c) => {
				const offset = ((tallest - col.length) * (NODE_H + GAP_Y)) / 2;
				col.forEach((id, i) => pos.set(id, { x: c * (NODE_W + GAP_X), y: offset + i * (NODE_H + GAP_Y) }));
			});
			return {
				pos,
				edges,
				width: Math.max(1, columns.length) * (NODE_W + GAP_X) - GAP_X,
				height: tallest * (NODE_H + GAP_Y) - GAP_Y,
			};
		}

		function GraphView({ graph, cached, errorNode, selected, onSelect }) {
			const [zoom, setZoom] = useState(1);
			const layout = useMemo(() => layoutGraph(graph), [graph]);
			const pad = 12;
			const W = layout.width + pad * 2;
			const H = layout.height + pad * 2;
			const connected = new Set();
			if (selected) for (const e of layout.edges) if (e.from === selected || e.to === selected) { connected.add(e.from); connected.add(e.to); }
			return h(
				'div',
				{ className: 'cmfy-graph' },
				h(
					'div',
					{ className: 'cmfy-graph-bar' },
					h('span', { className: 'cmfy-dim' }, t('nodesCount', { n: layout.pos.size })),
					h('span', { className: 'cmfy-spacer' }),
					h('button', { className: 'cmfy-icon-btn', title: t('zoomOut'), onClick: () => setZoom((z) => Math.max(0.3, +(z - 0.2).toFixed(2))) }, '−'),
					h('button', { className: 'cmfy-icon-btn cmfy-zoom', title: t('zoomFit'), onClick: () => setZoom(1) }, `${Math.round(zoom * 100)}%`),
					h('button', { className: 'cmfy-icon-btn', title: t('zoomIn'), onClick: () => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(2))) }, '+'),
				),
				h(
					'div',
					{ className: 'cmfy-graph-scroll' },
					h(
						'svg',
						{ width: W * zoom, height: H * zoom, viewBox: `0 0 ${W} ${H}`, role: 'img' },
						h(
							'g',
							{ transform: `translate(${pad} ${pad})` },
							layout.edges.map((e, i) => {
								const a = layout.pos.get(e.from);
								const b = layout.pos.get(e.to);
								const x1 = a.x + NODE_W;
								const y1 = a.y + NODE_H / 2;
								const x2 = b.x;
								const y2 = b.y + NODE_H / 2;
								const dx = Math.max(24, (x2 - x1) / 2);
								const hot = selected && (e.from === selected || e.to === selected);
								return h('path', {
									key: i,
									d: `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`,
									className: hot ? 'cmfy-edge cmfy-edge-hot' : 'cmfy-edge',
								});
							}),
							[...layout.pos.entries()].map(([id, p]) => {
								const node = graph[id];
								const isCached = cached?.has(id);
								const isError = errorNode === id;
								const cls = ['cmfy-node'];
								if (isCached) cls.push('cmfy-node-cached');
								if (isError) cls.push('cmfy-node-error');
								if (selected === id) cls.push('cmfy-node-selected');
								else if (selected && !connected.has(id)) cls.push('cmfy-node-faded');
								const title = node?._meta?.title || node?.class_type || id;
								return h(
									'g',
									{ key: id, className: cls.join(' '), transform: `translate(${p.x} ${p.y})`, onClick: () => onSelect(selected === id ? null : id) },
									h('title', null, `#${id} ${node?.class_type || ''}${isCached ? ` (${t('cached')})` : ''}`),
									h('rect', { className: 'cmfy-node-box', width: NODE_W, height: NODE_H, rx: 7 }),
									h('rect', { x: 0, y: 0, width: 5, height: NODE_H, rx: 2, fill: categoryColor(node?.class_type) }),
									h('text', { className: 'cmfy-node-title', x: 14, y: 19 }, trunc(title, 26)),
									h('text', { className: 'cmfy-node-sub', x: 14, y: 35 }, `#${id} ${trunc(node?.class_type, 22)}`),
								);
							}),
						),
					),
				),
			);
		}

		function CopyButton({ text }) {
			const [done, setDone] = useState(false);
			useEffect(() => {
				if (!done) return undefined;
				const timer = setTimeout(() => setDone(false), 1400);
				return () => clearTimeout(timer);
			}, [done]);
			return h('button', { className: 'cmfy-mini', title: t('copy'), onClick: (event) => { event.stopPropagation(); copyText(text).then(() => setDone(true)); } }, done ? t('copied') : t('copy'));
		}

		/** A long/multi-line string value in its own scroll box, with a copy button. */
		function TextBlock({ text, tone }) {
			const [open, setOpen] = useState(false);
			const long = text.length > 320 || text.split('\n').length > 6;
			return h(
				'div',
				{ className: `cmfy-textblock${tone ? ` cmfy-textblock-${tone}` : ''}` },
				text === '' ? h('span', { className: 'cmfy-dim cmfy-italic' }, t('emptyPrompt')) : h('div', { className: `cmfy-textblock-body${open ? ' cmfy-textblock-open' : ''}` }, text),
				text === ''
					? null
					: h('div', { className: 'cmfy-textblock-actions' }, long ? h('button', { className: 'cmfy-mini', onClick: () => setOpen(!open) }, open ? t('showLess') : t('showMore')) : null, h(CopyButton, { text })),
			);
		}

		/** One node's inputs: literals as values, links resolved to the source node and what it holds. */
		function InputRows({ serverId, graph, node, onSelect }) {
			const rows = Object.entries(node.inputs || {});
			if (!rows.length) return h('div', { className: 'cmfy-dim' }, t('noInputs'));
			const isLoadImage = /^LoadImage/.test(node.class_type || '');
			return rows.map(([name, value]) => {
				if (isLink(value)) {
					const src = graph?.[String(value[0])];
					const preview = sourcePreview(graph, value);
					return h(
						'div',
						{ key: name, className: 'cmfy-kv cmfy-kv-stack' },
						h('span', { className: 'cmfy-k' }, name),
						h(
							'div',
							{ className: 'cmfy-v-col' },
							h('button', { className: 'cmfy-linkchip', onClick: (event) => { event.stopPropagation(); onSelect?.(String(value[0])); }, title: src?.class_type }, `#${value[0]}${value[1] ? `.${value[1]}` : ''} · ${nodeTitle(src)}`),
							preview ? h('div', { className: 'cmfy-linkpreview' }, trunc(preview, 280)) : null,
						),
					);
				}
				const text = scalar(value);
				const big = typeof value === 'string' && (value.length > 90 || value.includes('\n'));
				return h(
					'div',
					{ key: name, className: `cmfy-kv${big ? ' cmfy-kv-stack' : ''}` },
					h('span', { className: 'cmfy-k' }, name),
					big
						? h(TextBlock, { text })
						: h(
								'span',
								{ className: 'cmfy-v' },
								text === '' && typeof value === 'string' ? h('span', { className: 'cmfy-dim cmfy-italic' }, t('emptyPrompt')) : text,
								isLoadImage && name === 'image' && typeof value === 'string' && value
									? h('a', { href: viewUrl(serverId, parseImageName(value), false), target: '_blank', rel: 'noreferrer', className: 'cmfy-inputimg' }, h('img', { src: viewUrl(serverId, parseImageName(value), true), loading: 'lazy', alt: value }))
									: null,
							),
				);
			});
		}

		function OutputThumbs({ serverId, files }) {
			if (!files.length) return null;
			return h(
				'div',
				{ className: 'cmfy-outthumbs' },
				files.map((f, i) =>
					/\.(png|jpe?g|webp|gif|bmp)$/i.test(f.filename)
						? h('a', { key: i, href: viewUrl(serverId, f, false), target: '_blank', rel: 'noreferrer' }, h('img', { src: viewUrl(serverId, f, true), loading: 'lazy', alt: f.filename }))
						: h('a', { key: i, href: viewUrl(serverId, f, false), target: '_blank', rel: 'noreferrer', className: 'cmfy-pill' }, f.filename),
				),
			);
		}
		function filesOfNode(outputs, id) {
			const group = outputs?.[id];
			const files = [];
			for (const list of Object.values(group || {})) if (Array.isArray(list)) for (const f of list) if (f && typeof f.filename === 'string') files.push(f);
			return files;
		}

		function NodeInspector({ serverId, id, graph, outputs, cached, errorNode, onSelect }) {
			const node = graph?.[id];
			if (!node) return null;
			const users = downstreamOf(graph, id);
			return h(
				'div',
				{ className: 'cmfy-inspector' },
				h('div', { className: 'cmfy-inspector-head' }, h('b', null, nodeTitle(node)), h('span', { className: 'cmfy-dim' }, ` #${id} · ${node.class_type}`), cached?.has(id) ? h('span', { className: 'cmfy-pill' }, t('cached')) : null, errorNode === id ? h('span', { className: 'cmfy-pill cmfy-pill-err' }, t('failedHere')) : null),
				h(InputRows, { serverId, graph, node, onSelect }),
				h(OutputThumbs, { serverId, files: filesOfNode(outputs, id) }),
				users.length
					? h('div', { className: 'cmfy-usedby' }, h('span', { className: 'cmfy-dim' }, t('usedBy')), users.map((u) => h('button', { key: u.id, className: 'cmfy-linkchip', onClick: () => onSelect?.(u.id), title: u.via.join(', ') }, `#${u.id} · ${trunc(u.title, 28)}`)))
					: null,
			);
		}

		function NodeList({ serverId, graph, cached, errorNode, onSelect }) {
			const entries = Object.entries(graph || {}).sort((a, b) => Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0]));
			return h(
				'div',
				{ className: 'cmfy-nodelist' },
				entries.map(([id, node]) =>
					h(
						'div',
						{ key: id, className: `cmfy-nodecard${errorNode === id ? ' cmfy-nodecard-error' : ''}`, style: { borderLeftColor: categoryColor(node.class_type) } },
						h('div', { className: 'cmfy-nodecard-head' }, h('b', null, nodeTitle(node)), h('span', { className: 'cmfy-dim' }, ` #${id} ${node._meta?.title ? node.class_type : ''}`), cached?.has(id) ? h('span', { className: 'cmfy-pill' }, t('cached')) : null),
						h(InputRows, { serverId, graph, node, onSelect }),
					),
				),
			);
		}

		function PromptSide({ label, items, tone, onSelect }) {
			return h(
				'div',
				{ className: `cmfy-prompt cmfy-prompt-${tone}` },
				h('div', { className: 'cmfy-prompt-label' }, label),
				items.length
					? items.map((item) =>
							h(
								'div',
								{ key: item.id, className: 'cmfy-prompt-item' },
								h('button', { className: 'cmfy-linkchip', onClick: () => onSelect?.(item.id), title: `${item.type} · ${item.key}` }, `#${item.id} · ${trunc(item.title, 34)}`),
								h(TextBlock, { text: item.text, tone }),
							),
						)
					: h('div', { className: 'cmfy-dim cmfy-italic' }, t('emptyPrompt')),
			);
		}
		function PromptsCard({ groups, onSelect }) {
			if (!groups.length) return null;
			return h(
				'div',
				{ className: 'cmfy-prompts' },
				groups.map((g, i) =>
					h(
						'div',
						{ key: `${g.id}:${i}`, className: 'cmfy-prompt-group' },
						groups.length > 1 && g.id ? h('div', { className: 'cmfy-dim cmfy-prompt-sampler' }, `#${g.id} · ${g.title}`) : null,
						h(PromptSide, { label: t('positive'), items: g.positive, tone: 'pos', onSelect }),
						g.id ? h(PromptSide, { label: t('negative'), items: g.negative, tone: 'neg', onSelect }) : null,
					),
				),
			);
		}

		function OutputsView({ serverId, outputs }) {
			const files = [];
			for (const [nodeId, group] of Object.entries(outputs || {})) {
				for (const list of Object.values(group || {})) {
					if (!Array.isArray(list)) continue;
					for (const f of list) if (f && typeof f.filename === 'string') files.push({ ...f, nodeId });
				}
			}
			if (!files.length) return h('div', { className: 'cmfy-empty' }, t('noOutputs'));
			return h(
				'div',
				{ className: 'cmfy-outputs' },
				files.map((f, i) => {
					const href = viewUrl(serverId, f, false);
					const isVideo = /\.(mp4|webm|mov)$/i.test(f.filename);
					const isImage = /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.filename);
					return h(
						'figure',
						{ key: i, className: 'cmfy-output' },
						isVideo
							? h('video', { src: href, controls: true, loop: true, muted: true })
							: isImage
								? h('a', { href, target: '_blank', rel: 'noreferrer' }, h('img', { src: viewUrl(serverId, f, true), loading: 'lazy', alt: f.filename }))
								: h('a', { href, target: '_blank', rel: 'noreferrer' }, f.filename),
						h('figcaption', { className: 'cmfy-dim' }, `#${f.nodeId} · ${trunc(f.filename, 38)}`),
					);
				}),
			);
		}

		// -------------------------------------------------------------- gallery
		const IMG_RE = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
		const VID_RE = /\.(mp4|webm|mov|mkv)$/i;
		function collectMedia(jobs, details, showTemp) {
			const items = [];
			const seen = new Set();
			for (const job of jobs) {
				if (job.status !== 'completed') continue;
				const detail = details.get(job.id);
				if (!detail) continue;
				for (const [nodeId, group] of Object.entries(detail.outputs || {})) {
					for (const list of Object.values(group || {})) {
						if (!Array.isArray(list)) continue;
						for (const file of list) {
							if (!file || typeof file.filename !== 'string' || (!IMG_RE.test(file.filename) && !VID_RE.test(file.filename))) continue;
							if (!showTemp && file.type === 'temp') continue;
							const key = `${job.id}:${nodeId}:${file.type}:${file.subfolder}/${file.filename}`;
							if (seen.has(key)) continue;
							seen.add(key);
							items.push({ key, file, nodeId, job, detail, video: VID_RE.test(file.filename), when: job.end || job.created || 0 });
						}
					}
				}
			}
			return items.sort((a, b) => b.when - a.when);
		}
		function fmtWhen(ms) {
			if (!ms) return '';
			try {
				return new Date(ms).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
			} catch {
				return '';
			}
		}

		const portal = (node, target) => (createPortal ? createPortal(node, target) : node);
		function Lightbox({ serverId, items, index, onIndex, onClose, onOpenJob }) {
			const item = items[index];
			const rootRef = useRef(null);
			const [fit, setFit] = useState(true);
			const [dims, setDims] = useState(null);
			useEffect(() => {
				rootRef.current?.focus();
			}, []);
			useEffect(() => {
				setDims(null);
				setFit(true);
			}, [index]);
			const go = (delta) => onIndex((index + delta + items.length) % items.length);
			const onKey = (event) => {
				if (event.key === 'Escape') onClose();
				else if (event.key === 'ArrowLeft') go(-1);
				else if (event.key === 'ArrowRight') go(1);
				else if (event.key === ' ' || event.key === 'f') {
					event.preventDefault();
					setFit((v) => !v);
				} else return;
				event.stopPropagation();
			};
			const groups = useMemo(() => findPrompts(item?.detail?.graph), [item]);
			const sum = useMemo(() => summarize(item?.detail?.graph), [item]);
			if (!item) return null;
			const pos = groups[0]?.positive.map((p) => p.text).filter(Boolean).join('\n\n');
			const href = viewUrl(serverId, item.file, false);
			return h(
				'div',
				{ className: 'cmfy-lightbox', ref: rootRef, tabIndex: -1, onKeyDown: onKey, onClick: onClose, role: 'dialog', 'aria-modal': true },
				h(
					'div',
					{ className: 'cmfy-lb-bar', onClick: (e) => e.stopPropagation() },
					h('span', { className: 'cmfy-dim cmfy-num' }, `${index + 1} / ${items.length}`),
					h('span', { className: 'cmfy-spacer' }),
					dims ? h('span', { className: 'cmfy-dim cmfy-num' }, `${dims.w}×${dims.h}`) : null,
					h('button', { className: 'cmfy-btn', onClick: () => setFit(!fit) }, fit ? t('actualSize') : t('fitView')),
					h('button', { className: 'cmfy-btn', onClick: () => onOpenJob(item.job.id) }, t('openJob')),
					h('a', { className: 'cmfy-btn cmfy-btn-link', href, target: '_blank', rel: 'noreferrer' }, t('openOriginal')),
					h('a', { className: 'cmfy-btn cmfy-btn-link', href, download: item.file.filename }, t('download')),
					h('button', { className: 'cmfy-btn', onClick: onClose, 'aria-label': t('close') }, '✕'),
				),
				h(
					'div',
					{ className: `cmfy-lb-stage${fit ? '' : ' cmfy-lb-stage-actual'}`, onClick: (e) => e.stopPropagation() },
					items.length > 1 ? h('button', { className: 'cmfy-lb-nav cmfy-lb-prev', onClick: () => go(-1), 'aria-label': t('prev') }, '‹') : null,
					item.video
						? h('video', { key: item.key, src: href, controls: true, autoPlay: true, loop: true, className: 'cmfy-lb-media' })
						: h('img', { key: item.key, src: href, alt: item.file.filename, className: `cmfy-lb-media${fit ? ' cmfy-lb-fit' : ''}`, onLoad: (e) => setDims({ w: e.target.naturalWidth, h: e.target.naturalHeight }), onClick: () => setFit(!fit) }),
					items.length > 1 ? h('button', { className: 'cmfy-lb-nav cmfy-lb-next', onClick: () => go(1), 'aria-label': t('next') }, '›') : null,
				),
				h(
					'div',
					{ className: 'cmfy-lb-caption', onClick: (e) => e.stopPropagation() },
					h('div', { className: 'cmfy-lb-meta' }, h('span', { className: 'cmfy-num' }, fmtWhen(item.when)), h('span', { className: 'cmfy-dim cmfy-num' }, ` · ${item.job.id.slice(0, 8)} · #${item.nodeId} · ${trunc(item.file.filename, 44)}`), sum.models.map((m) => h('span', { key: m, className: 'cmfy-pill' }, trunc(m, 36))), sum.sampler ? h('span', { className: 'cmfy-pill' }, sum.sampler) : null),
					pos ? h('div', { className: 'cmfy-lb-prompt' }, pos) : null,
				),
			);
		}

		function Gallery({ serverId, jobs, details, loaded, onOpenJob }) {
			const [size, setSize] = useStored('comfyui-panel.gallerySize', 220);
			const [layout, setLayout] = useStored('comfyui-panel.galleryLayout', 'masonry');
			const [showTemp, setShowTemp] = useState(false);
			const [open, setOpen] = useState(-1);
			const items = useMemo(() => collectMedia(jobs, details, showTemp), [jobs, details, showTemp]);
			useEffect(() => {
				if (open >= items.length) setOpen(items.length ? items.length - 1 : -1);
			}, [items.length, open]);
			return h(
				'div',
				{ className: 'cmfy-gallery' },
				h(
					'div',
					{ className: 'cmfy-gal-bar' },
					h('span', { className: 'cmfy-dim cmfy-num' }, t('galleryCount', { n: items.length })),
					h('span', { className: 'cmfy-spacer' }),
					h('label', { className: 'cmfy-check' }, h('input', { type: 'checkbox', checked: showTemp, onChange: (e) => setShowTemp(e.target.checked) }), t('showTemp')),
					h('div', { className: 'cmfy-seg' }, ['masonry', 'grid'].map((key) => h('button', { key, className: `cmfy-seg-btn${layout === key ? ' cmfy-seg-active' : ''}`, onClick: () => setLayout(key) }, t(`layout_${key}`)))),
					h('label', { className: 'cmfy-size' }, h('span', { className: 'cmfy-dim' }, t('gallerySize')), h('input', { type: 'range', min: 90, max: 520, step: 10, value: size, onChange: (e) => setSize(Number(e.target.value)) })),
				),
				items.length === 0
					? h('div', { className: 'cmfy-empty' }, loaded ? t('galleryEmpty') : '…')
					: h(
							'div',
							{ className: `cmfy-gal-grid cmfy-gal-${layout}`, style: { '--cmfy-gs': `${size}px` } },
							items.map((item, i) =>
								h(
									'button',
									{ key: item.key, className: 'cmfy-gal-item', onClick: () => setOpen(i), title: `${fmtWhen(item.when)} · ${item.file.filename}` },
									item.video
										? h('video', { src: viewUrl(serverId, item.file, false), muted: true, loop: true, preload: 'metadata', onMouseEnter: (e) => e.target.play?.(), onMouseLeave: (e) => e.target.pause?.() })
										: h('img', { src: viewUrl(serverId, item.file, true), loading: 'lazy', decoding: 'async', alt: item.file.filename }),
									h('span', { className: 'cmfy-gal-cap' }, fmtWhen(item.when)),
								),
							),
						),
				open >= 0 && items[open] ? portal(h(Lightbox, { serverId, items, index: open, onIndex: setOpen, onClose: () => setOpen(-1), onOpenJob: (id) => { setOpen(-1); onOpenJob(id); } }), document.body) : null,
			);
		}

		// ------------------------------------------------------------- settings
		async function settingsRequest(path, body) {
			const response = await fetch(`${BASE}/${path}`, body === undefined ? { credentials: 'same-origin' } : { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
			const data = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
			return data;
		}
		let draftSeq = 0;
		const toDraft = (s) => ({ key: `k${++draftSeq}`, id: s.id, name: s.name || '', url: s.url || '', hasAuth: Boolean(s.hasAuth), auth: '', authEdited: false });

		function SettingsEditor({ onSaved, onClose }) {
			useLocaleTick();
			const [remote, setRemote] = useState(null);
			const [servers, setServers] = useState([]);
			const [disc, setDisc] = useState({ enabled: true, host: '127.0.0.1', ports: '' });
			const [dirty, setDirty] = useState(false);
			const [msg, setMsg] = useState(null);
			const [tests, setTests] = useState({});
			const [busy, setBusy] = useState(false);
			const apply = useCallback((data) => {
				setRemote(data);
				setServers(data.servers.map(toDraft));
				setDisc({ enabled: data.discover.enabled, host: data.discover.host, ports: data.discover.ports.join(', ') });
				setDirty(false);
			}, []);
			const load = useCallback(() => settingsRequest('_config').then(apply).catch((e) => setMsg({ error: true, text: e.message })), [apply]);
			useEffect(() => {
				load();
			}, [load]);
			const patch = (key, change) => {
				setServers((list) => list.map((s) => (s.key === key ? { ...s, ...change } : s)));
				setDirty(true);
			};
			const test = async (s) => {
				setTests((x) => ({ ...x, [s.key]: { busy: true } }));
				try {
					const res = await settingsRequest('_probe', { id: s.id, url: s.url, auth: s.authEdited ? s.auth : undefined });
					setTests((x) => ({ ...x, [s.key]: res }));
				} catch (e) {
					setTests((x) => ({ ...x, [s.key]: { online: false, error: e.message } }));
				}
			};
			const save = async () => {
				setBusy(true);
				setMsg(null);
				try {
					const data = await settingsRequest('_config', {
						servers: servers.filter((s) => s.url.trim()).map((s) => ({ id: s.id, name: s.name, url: s.url, ...(s.authEdited ? { auth: s.auth } : {}) })),
						discover: { enabled: disc.enabled, host: disc.host, ports: disc.ports },
					});
					apply(data);
					setTests({});
					setMsg({ text: t('saved') });
					onSaved?.();
				} catch (e) {
					setMsg({ error: true, text: e.message });
				}
				setBusy(false);
			};
			if (!remote) return h('div', { className: 'cmfy-settings' }, h('style', null, CSS), msg ? h('div', { className: 'cmfy-banner' }, msg.text) : h('div', { className: 'cmfy-empty' }, '…'));
			return h(
				'div',
				{ className: 'cmfy-settings' },
				h('style', null, CSS),
				h('div', { className: 'cmfy-set-head' }, h('div', { className: 'cmfy-set-title' }, t('settingsTitle')), h('span', { className: 'cmfy-spacer' }), onClose ? h('button', { className: 'cmfy-btn', onClick: onClose }, t('close')) : null),
				h('p', { className: 'cmfy-dim cmfy-set-lead' }, t('settingsLead')),
				servers.map((s) => {
					const res = tests[s.key];
					return h(
						'div',
						{ key: s.key, className: 'cmfy-srv' },
						h(
							'div',
							{ className: 'cmfy-srv-fields' },
							h('label', { className: 'cmfy-field' }, h('span', null, t('serverName')), h('input', { className: 'cmfy-input', value: s.name, placeholder: t('serverNamePh'), onChange: (e) => patch(s.key, { name: e.target.value }) })),
							h('label', { className: 'cmfy-field cmfy-field-wide' }, h('span', null, t('serverUrl')), h('input', { className: 'cmfy-input', value: s.url, placeholder: 'http://192.168.0.20:8188', spellCheck: false, autoCapitalize: 'off', onChange: (e) => patch(s.key, { url: e.target.value }) })),
							h(
								'label',
								{ className: 'cmfy-field cmfy-field-wide' },
								h('span', null, t('serverAuth')),
								h('input', { className: 'cmfy-input', type: 'password', autoComplete: 'off', value: s.auth, placeholder: s.hasAuth && !s.authEdited ? t('authKeep') : t('authPlaceholder'), onChange: (e) => patch(s.key, { auth: e.target.value, authEdited: true }) }),
							),
						),
						h(
							'div',
							{ className: 'cmfy-srv-actions' },
							res ? (res.busy ? h('span', { className: 'cmfy-dim' }, t('testing')) : res.online ? h('span', { className: 'cmfy-ok' }, `● ${t('testOk')} · v${res.version || '?'}${res.device ? ` · ${trunc(res.device, 40)}` : ''}`) : h('span', { className: 'cmfy-err' }, `✕ ${t('testFail')}: ${res.error || ''}`)) : null,
							h('span', { className: 'cmfy-spacer' }),
							s.hasAuth && !s.authEdited ? h('button', { className: 'cmfy-btn', onClick: () => patch(s.key, { auth: '', authEdited: true }) }, t('removeAuth')) : null,
							h('button', { className: 'cmfy-btn', disabled: !s.url.trim() || res?.busy, onClick: () => test(s) }, t('test')),
							h('button', { className: 'cmfy-btn cmfy-btn-danger', onClick: () => { setServers((list) => list.filter((x) => x.key !== s.key)); setDirty(true); } }, t('removeServer')),
						),
					);
				}),
				servers.length === 0 ? h('div', { className: 'cmfy-empty cmfy-empty-small' }, t('noSavedServers')) : null,
				h('div', { className: 'cmfy-set-row' }, h('button', { className: 'cmfy-btn', onClick: () => { setServers((list) => [...list, toDraft({ name: '', url: '' })]); setDirty(true); } }, `+ ${t('addServer')}`)),
				remote.configServers.length
					? h('div', { className: 'cmfy-set-block' }, h('div', { className: 'cmfy-section-title' }, t('configServers')), remote.configServers.map((s) => h('div', { key: s.id, className: 'cmfy-dim cmfy-num' }, `${s.name} — ${s.url}`)))
					: null,
				h(
					'div',
					{ className: 'cmfy-set-block' },
					h('div', { className: 'cmfy-section-title' }, t('discoverTitle')),
					h('label', { className: 'cmfy-check' }, h('input', { type: 'checkbox', checked: disc.enabled, onChange: (e) => { setDisc({ ...disc, enabled: e.target.checked }); setDirty(true); } }), t('discoverEnable')),
					disc.enabled
						? h(
								'div',
								{ className: 'cmfy-srv-fields' },
								h('label', { className: 'cmfy-field' }, h('span', null, t('discoverHost')), h('input', { className: 'cmfy-input', value: disc.host, spellCheck: false, onChange: (e) => { setDisc({ ...disc, host: e.target.value }); setDirty(true); } })),
								h('label', { className: 'cmfy-field cmfy-field-wide' }, h('span', null, t('discoverPorts')), h('input', { className: 'cmfy-input', value: disc.ports, placeholder: '8188-8195', spellCheck: false, onChange: (e) => { setDisc({ ...disc, ports: e.target.value }); setDirty(true); } })),
							)
						: null,
					h('div', { className: 'cmfy-dim cmfy-set-note' }, t('discoverNote')),
				),
				h(
					'div',
					{ className: 'cmfy-set-foot' },
					h('button', { className: 'cmfy-btn cmfy-btn-primary', disabled: !dirty || busy, onClick: save }, t('save')),
					h('button', { className: 'cmfy-btn', disabled: !dirty || busy, onClick: () => { setMsg(null); load(); } }, t('revert')),
					msg ? h('span', { className: msg.error ? 'cmfy-err' : 'cmfy-ok' }, msg.text) : null,
				),
				h('div', { className: 'cmfy-dim cmfy-set-note' }, t('fileNote', { file: remote.file })),
			);
		}
		function ConfigPage() {
			return h('div', { className: 'cmfy-root cmfy-root-flat' }, h(SettingsEditor, null));
		}

		// ---------------------------------------------------------------- viewer
		/** Photos only: one big image + a filmstrip list; follows the newest generation until you pick another. */
		function PhotoViewer({ serverId, jobs, details, loaded, onOpenJob }) {
			const items = useMemo(() => collectMedia(jobs, details, false), [jobs, details]);
			const [sel, setSel] = useState(null);
			const [info, setInfo] = useStored('comfyui-panel.viewerInfo', '0');
			const [actual, setActual] = useState(false);
			const stripRef = useRef(null);
			const found = sel ? items.findIndex((i) => i.key === sel) : 0;
			const idx = found < 0 ? 0 : found;
			const item = items[idx];
			const running = jobs.some((j) => j.status === 'in_progress');
			const queued = jobs.filter((j) => j.status === 'pending').length;
			useEffect(() => setActual(false), [item?.key]);
			useEffect(() => {
				const strip = stripRef.current;
				const el = strip?.querySelector('[data-sel="1"]');
				if (strip && el) strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' });
			}, [item?.key]);
			const go = (to) => {
				if (!items.length) return;
				const n = Math.max(0, Math.min(items.length - 1, to));
				setSel(n === 0 ? null : items[n].key);
			};
			const onKey = (e) => {
				if (e.key === 'ArrowLeft') go(idx + 1);
				else if (e.key === 'ArrowRight') go(idx - 1);
				else if (e.key === 'Home') go(0);
				else if (e.key === 'End') go(items.length - 1);
				else if (e.key === 'i') setInfo(info === '1' ? '0' : '1');
				else if (e.key === 'f' || e.key === ' ') setActual((v) => !v);
				else return;
				e.preventDefault();
			};
			const groups = useMemo(() => findPrompts(item?.detail?.graph), [item]);
			const sum = useMemo(() => summarize(item?.detail?.graph), [item]);
			const busy = running ? h('div', { className: 'cmfy-vw-busy' }, h(Bar, undefined), h('span', null, t('generating'), queued ? ` ${t('queueMore', { n: queued })}` : '')) : null;
			if (!item)
				return h('div', { className: 'cmfy-viewer' }, busy, h('div', { className: 'cmfy-empty cmfy-vw-empty' }, loaded ? t('noPhotosYet') : '…'));
			const href = viewUrl(serverId, item.file, false);
			const pos = groups[0]?.positive.map((p) => p.text).filter(Boolean).join('\n\n');
			return h(
				'div',
				{ className: 'cmfy-viewer', tabIndex: 0, onKeyDown: onKey },
				busy,
				h(
					'div',
					{ className: `cmfy-vw-stage${actual ? ' cmfy-vw-stage-actual' : ''}` },
					item.video
						? h('video', { key: item.key, src: href, controls: true, autoPlay: true, loop: true, muted: true, className: 'cmfy-vw-media' })
						: h('img', { key: item.key, src: href, alt: item.file.filename, className: `cmfy-vw-media${actual ? '' : ' cmfy-vw-fit'}`, onClick: () => setActual(!actual), decoding: 'async' }),
					h('div', { className: 'cmfy-vw-top' }, h('span', { className: 'cmfy-vw-badge cmfy-num' }, `${idx + 1} / ${items.length}`), idx === 0 ? h('span', { className: 'cmfy-vw-badge cmfy-vw-badge-new' }, t('latest')) : null, h('span', { className: 'cmfy-spacer' }),
						h('button', { className: 'cmfy-vw-btn', title: t('fillView'), onClick: () => setActual(!actual) }, actual ? t('fitView') : t('fillView')),
						h('button', { className: `cmfy-vw-btn${info === '1' ? ' cmfy-vw-btn-on' : ''}`, onClick: () => setInfo(info === '1' ? '0' : '1') }, t('info')),
						onOpenJob ? h('button', { className: 'cmfy-vw-btn', onClick: () => onOpenJob(item.job.id) }, t('openJob')) : null,
						h('a', { className: 'cmfy-vw-btn', href, download: item.file.filename }, t('download'))),
					idx < items.length - 1 ? h('button', { className: 'cmfy-vw-nav cmfy-vw-prev', onClick: () => go(idx + 1), 'aria-label': t('prev') }, '‹') : null,
					idx > 0 ? h('button', { className: 'cmfy-vw-nav cmfy-vw-next', onClick: () => go(idx - 1), 'aria-label': t('next') }, '›') : null,
					info === '1'
						? h('div', { className: 'cmfy-vw-info' }, h('div', { className: 'cmfy-vw-meta' }, h('span', { className: 'cmfy-num' }, fmtWhen(item.when)), sum.models.map((m) => h('span', { key: m, className: 'cmfy-vw-chip' }, trunc(m, 34))), sum.sampler ? h('span', { className: 'cmfy-vw-chip' }, sum.sampler) : null, sum.size ? h('span', { className: 'cmfy-vw-chip' }, sum.size) : null), pos ? h('div', { className: 'cmfy-vw-prompt' }, pos) : null)
						: null,
				),
				h(
					'div',
					{ className: 'cmfy-vw-strip', ref: stripRef },
					items.map((it, i) =>
						h(
							'button',
							{ key: it.key, 'data-sel': i === idx ? '1' : '0', className: `cmfy-vw-thumb${i === idx ? ' cmfy-vw-thumb-on' : ''}`, onClick: () => go(i), title: `${fmtWhen(it.when)} · ${it.file.filename}` },
							it.video ? h('video', { src: viewUrl(serverId, it.file, false), muted: true, preload: 'metadata' }) : h('img', { src: viewUrl(serverId, it.file, true), loading: 'lazy', decoding: 'async', alt: '' }),
						),
					),
				),
			);
		}

		/** Standalone right-sidebar tab: servers + polling of its own, only the viewer on screen. */
		function PhotosTab() {
			useLocaleTick();
			const [serversState] = useServers();
			const [pickedId, setPickedId] = useStored(STORE_KEY, '');
			const servers = serversState.list;
			const server = servers.find((x) => x.id === pickedId) || servers[0];
			const serverId = server?.id;
			const [{ jobs, details, loaded }] = useJobs(serverId, null);
			return h(
				'div',
				{ className: 'cmfy-root cmfy-root-photos' },
				h('style', null, CSS),
				servers.length > 1 ? h('div', { className: 'cmfy-vw-servers' }, servers.map((x) => h('button', { key: x.id, className: `cmfy-chip${x.id === serverId ? ' cmfy-chip-active' : ''}`, onClick: () => setPickedId(x.id) }, h('span', { className: `cmfy-dot ${x.online ? 'cmfy-dot-completed' : 'cmfy-dot-failed'}` }), x.name))) : null,
				serverId ? h(PhotoViewer, { serverId, jobs, details, loaded }) : h('div', { className: 'cmfy-empty' }, serversState.loading ? t('scanning') : t('noServersTitle')),
			);
		}

		// -------------------------------------------------------------- widgets
		function ConfirmButton({ label, onConfirm, danger }) {
			const [armed, setArmed] = useState(false);
			useEffect(() => {
				if (!armed) return undefined;
				const timer = setTimeout(() => setArmed(false), 3000);
				return () => clearTimeout(timer);
			}, [armed]);
			return h(
				'button',
				{
					className: `cmfy-btn${armed || danger ? ' cmfy-btn-danger' : ''}`,
					onClick: (event) => {
						event.stopPropagation();
						if (armed) {
							setArmed(false);
							onConfirm();
						} else setArmed(true);
					},
				},
				armed ? t('confirm') : label,
			);
		}
		function Thumb({ serverId, job }) {
			const [broken, setBroken] = useState(false);
			const p = job.preview;
			const isImg = p && /\.(png|jpe?g|webp|gif|bmp)$/i.test(p.filename || '');
			if (!isImg || broken) return h('div', { className: 'cmfy-thumb cmfy-thumb-empty' });
			return h('img', { className: 'cmfy-thumb', loading: 'lazy', src: viewUrl(serverId, p, true), alt: '', onError: () => setBroken(true) });
		}
		function StatusDot({ status }) {
			return h('span', { className: `cmfy-dot cmfy-dot-${status}`, title: t(`status_${status}`) });
		}
		function Bar({ value }) {
			return h('div', { className: `cmfy-bar${value === undefined ? ' cmfy-bar-indeterminate' : ''}` }, h('div', { style: value === undefined ? undefined : { width: `${Math.round(value * 100)}%` } }));
		}
		function Meter({ label, used, total }) {
			const ratio = total > 0 ? Math.min(1, used / total) : 0;
			return h('div', { className: 'cmfy-meter', title: `${fmtBytes(used)} / ${fmtBytes(total)}` }, h('span', { className: 'cmfy-dim' }, label), h('div', { className: `cmfy-bar${ratio > 0.92 ? ' cmfy-bar-hot' : ''}` }, h('div', { style: { width: `${Math.round(ratio * 100)}%` } })), h('span', { className: 'cmfy-dim cmfy-num' }, `${fmtBytes(used)} / ${fmtBytes(total)}`));
		}

		// ---------------------------------------------------------------- hooks
		function useServers() {
			const [state, setState] = useState({ loading: true, list: [], error: null });
			const reload = useCallback(async (fresh) => {
				try {
					const response = await fetch(`${BASE}/_servers${fresh ? '?fresh=1' : ''}`, { credentials: 'same-origin' });
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const data = await response.json();
					setState({ loading: false, list: data.servers || [], error: null });
				} catch (error) {
					setState((s) => ({ ...s, loading: false, error: error.message }));
				}
			}, []);
			useEffect(() => {
				reload(false);
				const timer = setInterval(() => reload(false), SERVER_POLL_MS);
				return () => clearInterval(timer);
			}, [reload]);
			return [state, reload];
		}
		function useStats(serverId) {
			const [stats, setStats] = useState(null);
			useEffect(() => {
				setStats(null);
				if (!serverId) return undefined;
				let dead = false;
				const run = async () => {
					try {
						const data = await getJson(serverId, 'system_stats');
						if (!dead) setStats(data);
					} catch {
						if (!dead) setStats(null);
					}
				};
				run();
				const timer = setInterval(run, STAT_POLL_MS);
				return () => {
					dead = true;
					clearInterval(timer);
				};
			}, [serverId]);
			return stats;
		}
		function useJobs(serverId, selectedId) {
			const [state, setState] = useState({ jobs: [], details: new Map(), error: null, loaded: false });
			const selectedRef = useRef(selectedId);
			selectedRef.current = selectedId;
			const kickRef = useRef(() => {});
			useEffect(() => {
				setState({ jobs: [], details: new Map(), error: null, loaded: false });
				if (!serverId) return undefined;
				let dead = false;
				let timer;
				const cache = new Map();
				const mode = {};
				const loop = async () => {
					try {
						const jobs = await loadJobs(serverId, mode);
						if (dead) return;
						const wanted = jobs.slice(0, DETAIL_LIMIT);
						const sel = jobs.find((j) => j.id === selectedRef.current);
						if (sel && !wanted.includes(sel)) wanted.push(sel);
						const need = wanted.filter((j) => {
							const hit = cache.get(j.id);
							return !hit || (hit.status !== j.status && TERMINAL.has(j.status));
						});
						let changed = false;
						for (let i = 0; i < need.length && !dead; i += 4) {
							const batch = need.slice(i, i + 4);
							const loaded = await Promise.all(batch.map((j) => loadDetail(serverId, j, mode).catch(() => null)));
							loaded.forEach((d, k) => {
								if (d) {
									cache.set(batch[k].id, d);
									changed = true;
								}
							});
						}
						if (dead) return;
						setState((prev) => ({ jobs, details: changed ? new Map(cache) : prev.details, error: null, loaded: true }));
					} catch (error) {
						if (!dead) setState((prev) => ({ ...prev, error: error.message, loaded: true }));
					}
					if (!dead) timer = setTimeout(loop, document.hidden ? JOB_POLL_MS * 3 : JOB_POLL_MS);
				};
				kickRef.current = () => {
					clearTimeout(timer);
					loop();
				};
				loop();
				return () => {
					dead = true;
					clearTimeout(timer);
				};
			}, [serverId]);
			return [state, () => kickRef.current()];
		}

		// ---------------------------------------------------------------- panel
		function ServerBar({ servers, selectedId, onSelect, onRescan }) {
			return h(
				'div',
				{ className: 'cmfy-servers', role: 'tablist', 'aria-label': t('servers') },
				h('span', { className: 'cmfy-dim cmfy-servers-label' }, servers.length > 1 ? t('servers') : t('serverOne')),
				servers.map((s) =>
					h(
						'button',
						{
							key: s.id,
							role: 'tab',
							'aria-selected': s.id === selectedId,
							className: `cmfy-chip${s.id === selectedId ? ' cmfy-chip-active' : ''}${servers.length === 1 ? ' cmfy-chip-single' : ''}`,
							onClick: () => onSelect(s.id),
							title: `${s.url}${s.version ? ` · ComfyUI ${s.version}` : ''}${s.device ? ` · ${s.device}` : ''}`,
						},
						h('span', { className: `cmfy-dot ${s.online ? 'cmfy-dot-completed' : 'cmfy-dot-failed'}` }),
						h('span', null, s.name),
						s.version ? h('span', { className: 'cmfy-dim cmfy-chip-ver' }, `v${s.version}`) : null,
					),
				),
				h('span', { className: 'cmfy-spacer' }),
				h('button', { className: 'cmfy-icon-btn', title: t('rescan'), onClick: onRescan }, '↻'),
			);
		}

		function RunningCard({ serverId, job, detail, etaMs, now, onStop, selected, onSelect }) {
			const sum = useMemo(() => summarize(detail?.graph), [detail]);
			const elapsed = job.start ? now - job.start : 0;
			const progress = etaMs ? Math.min(0.97, elapsed / etaMs) : undefined;
			return h(
				'div',
				{ className: `cmfy-card cmfy-card-running${selected ? ' cmfy-card-selected' : ''}`, onClick: onSelect },
				h(
					'div',
					{ className: 'cmfy-card-row' },
					h(Thumb, { serverId, job }),
					h(
						'div',
						{ className: 'cmfy-card-main' },
						h('div', { className: 'cmfy-card-title' }, h(StatusDot, { status: 'in_progress' }), h('b', null, t('status_in_progress')), h('span', { className: 'cmfy-dim cmfy-num' }, ` ${t('elapsed')} ${fmtDur(elapsed)}${etaMs ? ` · ${t('eta', { time: fmtDur(etaMs) })}` : ''}`)),
						sum.prompt ? h('div', { className: 'cmfy-clamp' }, trunc(sum.prompt, 200)) : null,
						h('div', { className: 'cmfy-dim cmfy-clamp1' }, [sum.models[0], sum.sampler, sum.size].filter(Boolean).join(' · ')),
					),
					h(ConfirmButton, { label: t('stop'), onConfirm: onStop, danger: true }),
				),
				h(Bar, { value: progress }),
			);
		}

		function JobRow({ serverId, job, detail, selected, onSelect, now, index, onCancel }) {
			const sum = useMemo(() => summarize(detail?.graph), [detail]);
			const dur = job.start && job.end ? job.end - job.start : undefined;
			const pending = job.status === 'pending';
			return h(
				'div',
				{ className: `cmfy-row${selected ? ' cmfy-row-selected' : ''}`, onClick: onSelect, role: 'button', tabIndex: 0, onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && onSelect() },
				h(Thumb, { serverId, job }),
				h(
					'div',
					{ className: 'cmfy-card-main' },
					h(
						'div',
						{ className: 'cmfy-card-title' },
						h(StatusDot, { status: job.status }),
						h('span', null, pending ? t('position', { n: index + 1 }) : t(`status_${job.status}`)),
						h('span', { className: 'cmfy-dim cmfy-num' }, dur !== undefined ? ` · ${fmtDur(dur)}` : job.created ? ` · ${t('ago', { time: fmtDur(now - job.created) })}` : ''),
					),
					h('div', { className: 'cmfy-clamp1' }, sum.prompt ? trunc(sum.prompt, 120) : h('span', { className: 'cmfy-dim' }, job.id.slice(0, 8))),
					job.status === 'failed' && (detail?.error?.message || job.error?.exception_message) ? h('div', { className: 'cmfy-err cmfy-clamp1' }, trunc(detail?.error?.message || job.error?.exception_message, 140)) : null,
				),
				pending ? h(ConfirmButton, { label: t('cancel'), onConfirm: onCancel }) : null,
			);
		}

		function DetailPane({ serverId, job, detail }) {
			const [tab, setTab] = useState('graph');
			const [node, setNode] = useState(null);
			useEffect(() => setNode(null), [job?.id]);
			const groups = useMemo(() => findPrompts(detail?.graph), [detail?.graph]);
			if (!job) return h('div', { className: 'cmfy-empty cmfy-detail-empty' }, t('selectJob'));
			const sum = summarize(detail?.graph);
			const pick = (id) => {
				setTab('graph');
				setNode(id);
			};
			const tabs = [
				['graph', t('graph')],
				['nodes', t('nodes')],
				['outputs', `${t('outputs')}${job.outputsCount ? ` (${job.outputsCount})` : ''}`],
			];
			let body;
			if (!detail) body = h('div', { className: 'cmfy-empty' }, t('loadingDetail'));
			else if (tab === 'outputs') body = h(OutputsView, { serverId, outputs: detail.outputs });
			else if (!detail.graph || !Object.keys(detail.graph).length) body = h('div', { className: 'cmfy-empty' }, t('noGraph'));
			else if (tab === 'nodes') body = h(NodeList, { serverId, graph: detail.graph, cached: detail.cached, errorNode: detail.error?.node, onSelect: pick });
			else body = h(React.Fragment, null, h(GraphView, { graph: detail.graph, cached: detail.cached, errorNode: detail.error?.node, selected: node, onSelect: setNode }), node ? h(NodeInspector, { serverId, id: node, graph: detail.graph, outputs: detail.outputs, cached: detail.cached, errorNode: detail.error?.node, onSelect: setNode }) : h('div', { className: 'cmfy-dim cmfy-hint' }, t('clickNodeHint')));
			return h(
				'div',
				{ className: 'cmfy-detail' },
				h(
					'div',
					{ className: 'cmfy-detail-head' },
					h('div', { className: 'cmfy-card-title' }, h(StatusDot, { status: job.status }), h('b', null, t(`status_${job.status}`)), h('span', { className: 'cmfy-dim cmfy-num' }, ` ${job.id}`)),
					h('div', { className: 'cmfy-facts' }, sum.models.map((m) => h('span', { key: m, className: 'cmfy-pill' }, trunc(m, 42))), sum.sampler ? h('span', { className: 'cmfy-pill' }, sum.sampler) : null, sum.size ? h('span', { className: 'cmfy-pill' }, sum.size) : null),
					detail?.error ? h('div', { className: 'cmfy-err' }, t('failedAt', { id: detail.error.node, type: detail.error.type || '' }), detail.error.message ? `: ${trunc(detail.error.message, 300)}` : '') : null,
				),
				h(PromptsCard, { groups, onSelect: pick }),
				h('div', { className: 'cmfy-tabs', role: 'tablist' }, tabs.map(([key, label]) => h('button', { key, role: 'tab', 'aria-selected': tab === key, className: `cmfy-tab${tab === key ? ' cmfy-tab-active' : ''}`, onClick: () => setTab(key) }, label))),
				h('div', { className: 'cmfy-detail-body' }, body),
			);
		}

		function Panel() {
			useLocaleTick();
			const [serversState, reloadServers] = useServers();
			const [pickedId, setPickedId] = useState(() => {
				try {
					return localStorage.getItem(STORE_KEY) || '';
				} catch {
					return '';
				}
			});
			const servers = serversState.list;
			const server = servers.find((s) => s.id === pickedId) || servers[0];
			const serverId = server?.id;
			const choose = (id) => {
				setPickedId(id);
				try {
					localStorage.setItem(STORE_KEY, id);
				} catch {
					/* storage unavailable */
				}
			};
			const [chosenJob, setChosenJob] = useState(null);
			const [view, setView] = useStored('comfyui-panel.view', 'monitor');
			const [showSettings, setShowSettings] = useState(false);
			useEffect(() => setChosenJob(null), [serverId]);
			const [{ jobs, details, error, loaded }, refreshJobs] = useJobs(serverId, chosenJob);
			const stats = useStats(serverId);

			const [now, setNow] = useState(Date.now());
			const hasRunning = jobs.some((j) => j.status === 'in_progress');
			useEffect(() => {
				const timer = setInterval(() => setNow(Date.now()), hasRunning ? 1000 : 15000);
				return () => clearInterval(timer);
			}, [hasRunning]);

			const running = jobs.filter((j) => j.status === 'in_progress');
			const pending = jobs.filter((j) => j.status === 'pending');
			const history = jobs.filter((j) => TERMINAL.has(j.status));
			const activeId = chosenJob && jobs.some((j) => j.id === chosenJob) ? chosenJob : (running[0] || pending[0] || history[0])?.id;
			const activeJob = jobs.find((j) => j.id === activeId);

			const etaFor = useCallback(
				(job) => {
					const detail = details.get(job.id);
					if (!detail?.graph) return undefined;
					const sig = signature(detail.graph);
					const durations = history
						.filter((j) => j.status === 'completed' && j.start && j.end && details.get(j.id)?.graph && signature(details.get(j.id).graph) === sig)
						.map((j) => j.end - j.start);
					return median(durations);
				},
				[details, history],
			);

			const act = (fn) => async () => {
				try {
					await fn();
				} catch {
					/* surfaced by the next poll */
				}
				refreshJobs();
			};

			let body;
			if (serversState.loading) body = h('div', { className: 'cmfy-empty' }, t('scanning'));
			else if (!server)
				body = h(
					'div',
					{ className: 'cmfy-empty cmfy-empty-big' },
					h('div', { className: 'cmfy-empty-title' }, t('noServersTitle')),
					h('p', null, serversState.error ? t('connError', { msg: serversState.error }) : t('noServersBody')),
					h('div', { className: 'cmfy-row-actions' }, h('button', { className: 'cmfy-btn cmfy-btn-primary', onClick: () => setShowSettings(true) }, t('addFirst')), h('button', { className: 'cmfy-btn', onClick: () => reloadServers(true) }, t('rescan'))),
				);
			else if (view === 'viewer') body = h('div', { className: 'cmfy-body cmfy-body-viewer' }, h(PhotoViewer, { serverId, jobs, details, loaded, onOpenJob: (id) => { setChosenJob(id); setView('monitor'); } }));
			else if (view === 'gallery') body = h('div', { className: 'cmfy-body cmfy-body-gallery' }, h(Gallery, { serverId, jobs, details, loaded, onOpenJob: (id) => { setChosenJob(id); setView('monitor'); } }));
			else
				body = h(
					'div',
					{ className: 'cmfy-body' },
					h(
						'div',
						{ className: 'cmfy-left' },
						error ? h('div', { className: 'cmfy-banner' }, t('connError', { msg: error })) : null,
						h('div', { className: 'cmfy-section-title' }, t('running')),
						running.length ? running.map((j) => h(RunningCard, { key: j.id, serverId, job: j, detail: details.get(j.id), etaMs: etaFor(j), now, selected: j.id === activeId, onSelect: () => setChosenJob(j.id), onStop: act(() => postJson(serverId, 'interrupt', { prompt_id: j.id })) })) : h('div', { className: 'cmfy-empty cmfy-empty-small' }, loaded ? t('nothingRunning') : '…'),
						h('div', { className: 'cmfy-section-title' }, `${t('pending')} (${pending.length})`),
						pending.length ? pending.map((j, i) => h(JobRow, { key: j.id, serverId, job: j, detail: details.get(j.id), selected: j.id === activeId, onSelect: () => setChosenJob(j.id), now, index: i, onCancel: act(() => postJson(serverId, 'queue', { delete: [j.id] })) })) : h('div', { className: 'cmfy-empty cmfy-empty-small' }, t('queueEmpty')),
						h('div', { className: 'cmfy-section-title' }, `${t('history')} (${history.length})`),
						history.length ? history.map((j) => h(JobRow, { key: j.id, serverId, job: j, detail: details.get(j.id), selected: j.id === activeId, onSelect: () => setChosenJob(j.id), now, index: 0 })) : h('div', { className: 'cmfy-empty cmfy-empty-small' }, loaded ? t('historyEmpty') : '…'),
					),
					h('div', { className: 'cmfy-right' }, h(DetailPane, { key: serverId, serverId, job: activeJob, detail: activeJob ? details.get(activeJob.id) : undefined })),
				);

			if (showSettings) body = h('div', { className: 'cmfy-body cmfy-body-settings' }, h(SettingsEditor, { onSaved: () => { reloadServers(true); }, onClose: () => setShowSettings(false) }));
			const dev = stats?.devices?.[0];
			return h(
				'div',
				{ className: 'cmfy-root' },
				h('style', null, CSS),
				h(
					'div',
					{ className: 'cmfy-head' },
					h('div', { className: 'cmfy-titlebar' }, h('div', { className: 'cmfy-title' }, t('panel')), h('div', { className: 'cmfy-seg' }, ['monitor', 'viewer', 'gallery'].map((key) => h('button', { key, className: `cmfy-seg-btn${view === key && !showSettings ? ' cmfy-seg-active' : ''}`, onClick: () => { setShowSettings(false); setView(key); } }, t(key)))), h('span', { className: 'cmfy-spacer' }), h('button', { className: `cmfy-icon-btn${showSettings ? ' cmfy-icon-btn-on' : ''}`, title: t('settings'), 'aria-label': t('settings'), onClick: () => setShowSettings((v) => !v) }, '⚙')),
					servers.length ? h(ServerBar, { servers, selectedId: serverId, onSelect: choose, onRescan: () => { reloadServers(true); refreshJobs(); } }) : null,
					stats
						? h('div', { className: 'cmfy-stats' }, dev ? h(Meter, { label: t('vram'), used: dev.vram_total - dev.vram_free, total: dev.vram_total }) : null, stats.system?.ram_total ? h(Meter, { label: t('ram'), used: stats.system.ram_total - stats.system.ram_free, total: stats.system.ram_total }) : null, dev ? h('span', { className: 'cmfy-dim cmfy-clamp1' }, dev.name) : null)
						: null,
				),
				body,
			);
		}

		function Icon({ size = 20 }) {
			return h(
				'svg',
				{ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
				h('rect', { x: 3, y: 4, width: 6, height: 5, rx: 1.4 }),
				h('rect', { x: 3, y: 15, width: 6, height: 5, rx: 1.4 }),
				h('rect', { x: 15, y: 9.5, width: 6, height: 5, rx: 1.4 }),
				h('path', { d: 'M9 6.5h2.5c2 0 2 5 3.5 5M9 17.5h2.5c2 0 2-5 3.5-5' }),
			);
		}

		function OpenButton({ onOpen }) {
			useLocaleTick();
			return h(
				'button',
				{
					type: 'button',
					title: t('openRight'),
					'aria-label': t('openRight'),
					onClick: onOpen,
					style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, padding: 0, border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer' },
				},
				h(Icon, { size: 18 }),
			);
		}

		const CSS = `
.cmfy-root{container-type:inline-size;--cmfy-accent:var(--dsw-alias-brand-primary);display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:13px;line-height:1.4}
.cmfy-root *{box-sizing:border-box}
.cmfy-head{display:flex;flex-direction:column;gap:8px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.cmfy-title{font-size:15px;font-weight:600}
.cmfy-dim{color:var(--dsw-alias-label-secondary)}
.cmfy-num{font-variant-numeric:tabular-nums}
.cmfy-spacer{flex:1}
.cmfy-servers{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cmfy-servers-label{margin-right:2px}
.cmfy-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit}
.cmfy-chip:hover{border-color:var(--cmfy-accent)}
.cmfy-chip-active{border-color:var(--cmfy-accent);box-shadow:0 0 0 1px var(--cmfy-accent) inset}
.cmfy-chip-single{cursor:default}
.cmfy-chip-ver{font-size:11px}
.cmfy-stats{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.cmfy-meter{display:flex;align-items:center;gap:6px}
.cmfy-meter .cmfy-bar{width:90px}
.cmfy-bar{height:6px;border-radius:3px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;position:relative}
.cmfy-bar>div{height:100%;background:var(--cmfy-accent);border-radius:3px;transition:width .4s}
.cmfy-bar-hot>div{background:var(--dsw-alias-state-warn-primary)}
.cmfy-bar-indeterminate>div{position:absolute;width:35%;animation:cmfy-slide 1.4s ease-in-out infinite}
@keyframes cmfy-slide{0%{left:-35%}100%{left:100%}}
.cmfy-dot{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block;background:var(--dsw-alias-state-idle-primary)}
.cmfy-dot-completed{background:var(--dsw-alias-state-success-primary)}
.cmfy-dot-failed{background:var(--dsw-alias-state-error-primary)}
.cmfy-dot-in_progress{background:var(--cmfy-accent);animation:cmfy-pulse 1.2s ease-in-out infinite}
.cmfy-dot-pending{background:var(--dsw-alias-state-warn-primary)}
@keyframes cmfy-pulse{50%{opacity:.35}}
.cmfy-body{display:grid;grid-template-columns:minmax(290px,360px) minmax(0,1fr);flex:1;min-height:0}
.cmfy-left{overflow:auto;padding:12px;border-right:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;gap:6px}
.cmfy-right{overflow:auto;padding:12px 16px;min-width:0}
.cmfy-section-title{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);margin:10px 0 2px;font-weight:600}
.cmfy-left>.cmfy-section-title:first-child{margin-top:0}
.cmfy-card,.cmfy-row{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:8px;cursor:pointer;min-width:0}
.cmfy-row{display:flex;gap:8px;align-items:center}
.cmfy-card:hover,.cmfy-row:hover{border-color:var(--dsw-alias-border-l2)}
.cmfy-card-selected,.cmfy-row-selected{border-color:var(--cmfy-accent)!important}
.cmfy-card-running{display:flex;flex-direction:column;gap:8px}
.cmfy-card-row{display:flex;gap:8px;align-items:flex-start}
.cmfy-card-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.cmfy-card-title{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.cmfy-thumb{width:52px;height:52px;border-radius:7px;object-fit:cover;flex:none;background:var(--dsw-alias-bg-layer-2)}
.cmfy-clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.cmfy-clamp3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;color:var(--dsw-alias-label-secondary)}
.cmfy-clamp1{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmfy-err{color:var(--dsw-alias-state-error-primary)}
.cmfy-banner{padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.cmfy-btn{padding:4px 10px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;flex:none}
.cmfy-btn:hover{border-color:var(--cmfy-accent)}
.cmfy-btn-danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.cmfy-icon-btn{min-width:26px;height:26px;padding:0 6px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit}
.cmfy-icon-btn:hover{border-color:var(--cmfy-accent)}
.cmfy-empty{color:var(--dsw-alias-label-secondary);padding:16px;text-align:center}
.cmfy-empty-small{padding:8px;text-align:left}
.cmfy-empty-big{margin:auto;max-width:460px;display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px 16px}
.cmfy-empty-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}
.cmfy-detail{display:flex;flex-direction:column;gap:10px;min-width:0}
.cmfy-detail-head{display:flex;flex-direction:column;gap:6px}
.cmfy-facts{display:flex;gap:6px;flex-wrap:wrap}
.cmfy-pill{display:inline-block;padding:1px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);font-size:12px;margin-left:4px}
.cmfy-facts .cmfy-pill{margin-left:0}
.cmfy-tabs{display:flex;gap:2px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.cmfy-tab{padding:6px 12px;border:none;border-bottom:2px solid transparent;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit}
.cmfy-tab-active{color:var(--dsw-alias-label-primary);border-bottom-color:var(--cmfy-accent)}
.cmfy-graph{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.cmfy-graph-bar{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.cmfy-zoom{min-width:48px}
.cmfy-graph-scroll{overflow:auto;max-height:60vh;padding:4px}
.cmfy-graph svg{display:block}
.cmfy-edge{fill:none;stroke:var(--dsw-alias-border-l2);stroke-width:1.5}
.cmfy-edge-hot{stroke:var(--cmfy-accent);stroke-width:2}
.cmfy-node{cursor:pointer}
.cmfy-node-box{fill:var(--dsw-alias-bg-layer-2);stroke:var(--dsw-alias-border-l2);stroke-width:1}
.cmfy-node-cached .cmfy-node-box{stroke-dasharray:4 3;opacity:.75}
.cmfy-node-error .cmfy-node-box{stroke:var(--dsw-alias-state-error-primary);stroke-width:2}
.cmfy-node-selected .cmfy-node-box{stroke:var(--cmfy-accent);stroke-width:2}
.cmfy-node-faded{opacity:.35}
.cmfy-node-title{font-size:12px;font-weight:600;fill:var(--dsw-alias-label-primary)}
.cmfy-node-sub{font-size:10.5px;fill:var(--dsw-alias-label-secondary)}
.cmfy-inspector,.cmfy-nodecard{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:8px 10px}
.cmfy-inspector{margin-top:2px}
.cmfy-nodelist{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}
.cmfy-nodecard{border-left:4px solid var(--dsw-alias-border-l2);min-width:0}
.cmfy-nodecard-error{border-color:var(--dsw-alias-state-error-primary)}
.cmfy-nodecard-head{margin-bottom:4px;display:flex;align-items:baseline;gap:2px;flex-wrap:wrap}
.cmfy-kv{display:flex;gap:8px;padding:2px 0;min-width:0}
.cmfy-k{flex:none;width:38%;max-width:150px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis}
.cmfy-v{min-width:0;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.cmfy-v-link{color:var(--cmfy-accent)}
.cmfy-outputs{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
.cmfy-output{margin:0;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}
.cmfy-output img,.cmfy-output video{display:block;width:100%;height:auto}
.cmfy-output figcaption{padding:4px 8px;font-size:11px}
.cmfy-titlebar{display:flex;align-items:center;gap:10px}
.cmfy-titlebar .cmfy-icon-btn{font-size:17px;line-height:1}
.cmfy-icon-btn-on{border-color:var(--cmfy-accent);color:var(--cmfy-accent)}
.cmfy-seg{display:inline-flex;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden}
.cmfy-seg-btn{padding:3px 12px;border:none;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit}
.cmfy-seg-btn+.cmfy-seg-btn{border-left:1px solid var(--dsw-alias-border-l2)}
.cmfy-seg-active{background:var(--cmfy-accent);color:var(--dsw-alias-bg-base);font-weight:600}
.cmfy-row-actions{display:flex;gap:8px}
.cmfy-body-gallery,.cmfy-body-settings{display:block;overflow:auto;padding:12px 16px}
.cmfy-italic{font-style:italic}
.cmfy-mini{padding:1px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:11px}
.cmfy-mini:hover{border-color:var(--cmfy-accent);color:var(--dsw-alias-label-primary)}
.cmfy-linkchip{display:inline-block;max-width:100%;padding:1px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--cmfy-accent);cursor:pointer;font:inherit;font-size:12px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmfy-linkchip:hover{border-color:var(--cmfy-accent)}
.cmfy-linkpreview{margin-top:3px;padding:4px 8px;border-left:2px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-size:12px;word-break:break-word;white-space:pre-wrap;max-height:90px;overflow:auto}
.cmfy-kv-stack{flex-direction:column;gap:3px}
.cmfy-kv-stack>.cmfy-k{width:auto;max-width:none}
.cmfy-v-col{min-width:0;display:flex;flex-direction:column;align-items:flex-start}
.cmfy-textblock{width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);padding:6px 8px;display:flex;flex-direction:column;gap:4px;min-width:0}
.cmfy-textblock-pos{border-left:3px solid var(--dsw-alias-state-success-primary)}
.cmfy-textblock-neg{border-left:3px solid var(--dsw-alias-state-error-primary)}
.cmfy-textblock-body{white-space:pre-wrap;word-break:break-word;font-size:12.5px;max-height:7.5em;overflow:hidden;-webkit-mask-image:linear-gradient(#000 70%,transparent);mask-image:linear-gradient(#000 70%,transparent)}
.cmfy-textblock-open{max-height:28em;overflow:auto;-webkit-mask-image:none;mask-image:none}
.cmfy-textblock-actions{display:flex;gap:6px;justify-content:flex-end}
.cmfy-inspector{margin-top:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:10px 12px;display:flex;flex-direction:column;gap:4px}
.cmfy-inspector-head{display:flex;gap:2px;align-items:baseline;flex-wrap:wrap;margin-bottom:4px}
.cmfy-pill-err{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.cmfy-usedby{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px}
.cmfy-hint{margin-top:8px}
.cmfy-inputimg{display:block;margin-top:4px}
.cmfy-inputimg img{max-width:160px;max-height:120px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);display:block}
.cmfy-outthumbs{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.cmfy-outthumbs img{height:96px;width:auto;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);display:block}
.cmfy-prompts{display:flex;flex-direction:column;gap:10px}
.cmfy-prompt-group{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
.cmfy-prompt-sampler{grid-column:1/-1;font-size:12px}
.cmfy-prompt{display:flex;flex-direction:column;gap:4px;min-width:0}
.cmfy-prompt-label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:600}
.cmfy-prompt-pos .cmfy-prompt-label{color:var(--dsw-alias-state-success-primary)}
.cmfy-prompt-neg .cmfy-prompt-label{color:var(--dsw-alias-state-error-primary)}
.cmfy-prompt-item{display:flex;flex-direction:column;gap:3px;align-items:flex-start}
.cmfy-gallery{display:flex;flex-direction:column;gap:10px}
.cmfy-gal-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;position:sticky;top:-12px;z-index:2;padding:6px 0;background:var(--dsw-alias-bg-base)}
.cmfy-check{display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:var(--dsw-alias-label-secondary)}
.cmfy-size{display:inline-flex;align-items:center;gap:6px}
.cmfy-size input{width:120px;accent-color:var(--dsw-alias-brand-primary)}
.cmfy-gal-grid{--cmfy-gs:220px}
.cmfy-gal-masonry{column-width:var(--cmfy-gs);column-gap:10px}
.cmfy-gal-grid.cmfy-gal-grid{}
.cmfy-gal-grid.cmfy-gal-grid:not(.cmfy-gal-masonry){display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--cmfy-gs),1fr));gap:10px}
.cmfy-gal-item{position:relative;display:block;width:100%;margin:0 0 10px;padding:0;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-1);cursor:zoom-in;break-inside:avoid;color:inherit}
.cmfy-gal-grid:not(.cmfy-gal-masonry) .cmfy-gal-item{margin:0;aspect-ratio:1/1}
.cmfy-gal-grid:not(.cmfy-gal-masonry) .cmfy-gal-item img,.cmfy-gal-grid:not(.cmfy-gal-masonry) .cmfy-gal-item video{height:100%;object-fit:cover}
.cmfy-gal-item:hover{border-color:var(--cmfy-accent)}
.cmfy-gal-item img,.cmfy-gal-item video{display:block;width:100%;height:auto}
.cmfy-gal-cap{position:absolute;left:0;right:0;bottom:0;padding:14px 8px 4px;font-size:11px;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.65));opacity:0;transition:opacity .15s;text-align:left}
.cmfy-gal-item:hover .cmfy-gal-cap{opacity:1}
.cmfy-lightbox{--cmfy-accent:var(--dsw-alias-brand-primary);font-size:13px;line-height:1.4;font-family:inherit;position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.88);display:flex;flex-direction:column;outline:none;color:#eee}
.cmfy-lb-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;flex-wrap:wrap}
.cmfy-lb-bar .cmfy-dim{color:#aaa}
.cmfy-btn-link{text-decoration:none;display:inline-block}
.cmfy-lb-stage{flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
.cmfy-lb-stage-actual{overflow:auto;display:block}
.cmfy-lb-media{display:block;margin:auto}
.cmfy-lb-fit{max-width:100%;max-height:100%;object-fit:contain;cursor:zoom-in}
.cmfy-lb-stage-actual .cmfy-lb-media{max-width:none;cursor:zoom-out}
video.cmfy-lb-media{max-width:100%;max-height:100%}
.cmfy-lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:64px;border:none;border-radius:10px;background:rgba(0,0,0,.45);color:#fff;font-size:34px;cursor:pointer;z-index:1}
.cmfy-lb-nav:hover{background:rgba(0,0,0,.75)}
.cmfy-lb-prev{left:10px}.cmfy-lb-next{right:10px}
.cmfy-lb-caption{padding:8px 16px 12px;max-height:22vh;overflow:auto;display:flex;flex-direction:column;gap:4px;font-size:12.5px}
.cmfy-lb-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.cmfy-lb-prompt{white-space:pre-wrap;word-break:break-word;color:#ddd}
.cmfy-settings{display:flex;flex-direction:column;gap:12px;max-width:760px}
.cmfy-root-flat{height:auto;padding:16px;background:transparent}
.cmfy-set-head{display:flex;align-items:center;gap:8px}
.cmfy-set-title{font-size:15px;font-weight:600}
.cmfy-set-lead,.cmfy-set-note{margin:0;font-size:12.5px}
.cmfy-set-block{display:flex;flex-direction:column;gap:6px;padding-top:6px;border-top:1px solid var(--dsw-alias-border-l1)}
.cmfy-set-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cmfy-srv{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.cmfy-srv-fields{display:flex;gap:8px;flex-wrap:wrap}
.cmfy-field{display:flex;flex-direction:column;gap:3px;min-width:150px;flex:1 1 150px}
.cmfy-field-wide{flex:2 1 260px}
.cmfy-field>span{font-size:11px;color:var(--dsw-alias-label-secondary)}
.cmfy-input{padding:5px 8px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;min-width:0;width:100%}
.cmfy-input:focus{outline:none;border-color:var(--cmfy-accent)}
.cmfy-srv-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cmfy-ok{color:var(--dsw-alias-state-success-primary)}
.cmfy-btn-primary{background:var(--cmfy-accent);border-color:var(--cmfy-accent);color:var(--dsw-alias-bg-base);font-weight:600}
.cmfy-btn:disabled{opacity:.45;cursor:default}
.cmfy-root-flat,.cmfy-settings{--cmfy-accent:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.4}
.cmfy-settings *{box-sizing:border-box}
.cmfy-body-viewer{display:flex;flex-direction:column;padding:0;overflow:hidden;min-height:0}
.cmfy-root-photos{background:var(--dsw-alias-bg-base)}
.cmfy-vw-servers{display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.cmfy-viewer{flex:1;min-height:0;display:flex;flex-direction:column;outline:none;position:relative}
.cmfy-vw-busy{display:flex;flex-direction:column;gap:4px;padding:6px 12px;font-size:12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1)}
.cmfy-vw-empty{margin:auto}
.cmfy-vw-stage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-base);overflow:hidden}
.cmfy-vw-stage-actual{display:block;overflow:auto}
.cmfy-vw-media{display:block;margin:auto}
.cmfy-vw-fit{max-width:100%;max-height:100%;object-fit:contain;cursor:zoom-in}
.cmfy-vw-stage-actual .cmfy-vw-media{max-width:none;cursor:zoom-out}
video.cmfy-vw-media{max-width:100%;max-height:100%}
.cmfy-vw-top{position:absolute;top:0;left:0;right:0;display:flex;gap:6px;align-items:center;padding:8px 10px;background:linear-gradient(rgba(0,0,0,.55),transparent);opacity:0;transition:opacity .15s;pointer-events:none}
.cmfy-vw-stage:hover .cmfy-vw-top,.cmfy-viewer:focus-within .cmfy-vw-top{opacity:1;pointer-events:auto}
.cmfy-vw-badge{padding:1px 8px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;font-size:12px}
.cmfy-vw-badge-new{background:var(--dsw-alias-brand-primary)}
.cmfy-vw-btn{padding:2px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.55);color:#fff;cursor:pointer;font:inherit;font-size:12px;text-decoration:none}
.cmfy-vw-btn:hover,.cmfy-vw-btn-on{border-color:var(--dsw-alias-brand-primary)}
.cmfy-vw-nav{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:56px;border:none;border-radius:10px;background:rgba(0,0,0,.45);color:#fff;font-size:30px;cursor:pointer;opacity:0;transition:opacity .15s}
.cmfy-vw-stage:hover .cmfy-vw-nav,.cmfy-vw-nav:focus-visible{opacity:1}
.cmfy-vw-nav:hover{background:rgba(0,0,0,.75)}
.cmfy-vw-prev{left:8px}.cmfy-vw-next{right:8px}
.cmfy-vw-info{position:absolute;left:0;right:0;bottom:0;max-height:45%;overflow:auto;padding:24px 14px 10px;background:linear-gradient(transparent,rgba(0,0,0,.78));color:#eee;display:flex;flex-direction:column;gap:6px;font-size:12.5px}
.cmfy-vw-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.cmfy-vw-chip{padding:0 8px;border-radius:999px;border:1px solid rgba(255,255,255,.3)}
.cmfy-vw-prompt{white-space:pre-wrap;word-break:break-word}
.cmfy-vw-strip{position:relative;flex:none;display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);scrollbar-width:thin}
.cmfy-vw-thumb{flex:none;width:68px;height:68px;padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);cursor:pointer;opacity:.65}
.cmfy-vw-thumb:hover{opacity:1}
.cmfy-vw-thumb-on{border-color:var(--dsw-alias-brand-primary);opacity:1}
.cmfy-vw-thumb img,.cmfy-vw-thumb video{display:block;width:100%;height:100%;object-fit:cover}

@container (max-width:760px){.cmfy-prompt-group{grid-template-columns:minmax(0,1fr)}}

@container (max-width:760px){.cmfy-body{grid-template-columns:minmax(0,1fr);overflow:auto;display:block}.cmfy-left{border-right:none;border-bottom:1px solid var(--dsw-alias-border-l1);overflow:visible}.cmfy-right{overflow:visible}}
`;

		return {
			inject: ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight'],
			apply(ctx) {
				ctx.effect(() => ctx.locale.register(NS, { en, zh, pt }), 'comfyui-panel: dictionaries');
				t = ctx.locale.bind(NS);
				subscribeLocale = (fn) => ctx.locale.subscribe(fn);
				ctx.slots.inject('main', () =>
					ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS, inject: () => ({}) }, Panel),
				);
				// Same panel as a native right-sidebar tab (guide "+" entry and a session-header button).
				ctx.effect(
					() =>
						ctx.sidebarRightTabs.register({
							id: TAB_ID,
							kind: TAB_KIND,
							keepMounted: true,
							title: () => t('panel'),
							guide: [{ id: 'open', order: 40, title: () => t('panel'), description: () => t('openRight'), icon: Icon }],
						}),
					'comfyui-panel: right tab type',
				);
				ctx.slots.inject('sidebar.right.pane.tab', () =>
					ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID, locale: NS, inject: () => ({}) }, Panel),
				);
				ctx.slots.inject('conversation.session.header.utilities', () =>
					ctx.slots.register(
						{ name: 'conversation.session.header.utilities', id: 'comfyui-open', order: 30, locale: NS, inject: () => ({ onOpen: () => ctx.sidebarRight.openTab(TAB_KIND) }) },
						OpenButton,
					),
				);
				ctx.effect(
					() =>
						ctx.sidebarRightTabs.register({
							id: PHOTOS_TAB_ID,
							kind: PHOTOS_KIND,
							keepMounted: true,
							title: () => t('photos'),
							guide: [{ id: 'open', order: 41, title: () => t('photos'), description: () => t('openPhotos'), icon: Icon }],
						}),
					'comfyui-panel: photos tab type',
				);
				ctx.slots.inject('sidebar.right.pane.tab', () =>
					ctx.slots.register({ name: 'sidebar.right.pane.tab', key: PHOTOS_TAB_ID, locale: NS, inject: () => ({}) }, PhotosTab),
				);
				ctx.slots.inject('plugins.bundle.config', () =>
					ctx.slots.register({ name: 'plugins.bundle.config', key: '@local/comfyui-panel', locale: NS, inject: () => ({}) }, ConfigPage),
				);
				ctx.slots.inject('sidebar.panellist', () =>
					ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 40, locale: NS, label: () => t('panel') }, Icon),
				);
			},
		};
	},
});
