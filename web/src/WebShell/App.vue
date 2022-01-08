<script setup lang="ts">
import {provide, onMounted, reactive, nextTick, watch, computed} from 'vue'
import {ElLoading} from "element-plus"
import {getQueryVariable, getOSIcon, calcTime, formatByteSizeToStr} from '../Utils'
import {IServer, RemoteSystemInfo} from '../types'
import IconFont from '../iconfont.vue';
import WebSocketClient from "../lib/WebSocketClient";
import YLEventEmitter from "../lib/YLEventEmitter";
import Explorer from './Explorer.vue'
import Monitor from './Monitor.vue'
import {Terminal} from "xterm";
import {FitAddon} from "xterm-addon-fit";
import 'xterm/css/xterm.css'
import 'xterm/lib/xterm.js'


const ws = new WebSocketClient('/api/shell')
const emitter = new YLEventEmitter()
const uuid = getQueryVariable('uuid')
if (!uuid){
	alert('未获取到密钥')
	window.close()
}
provide('ws', ws)
provide('event', emitter)
provide('uuid', uuid)
const state = reactive({
	view: 'shell',
	server: {} as IServer,
	ready: false,
	systemInfo: {
		hostname: '-',
		uptime: '',
		cpu: 0,
		activities: [],
		mem: {},
		disks: [],
		network: []
	} as RemoteSystemInfo,
	runtime: '-',
	downUp: '-'
})
let connected = false
let term = {} as Terminal
let fitAddon = new FitAddon();

watch(() => state.view, (val: string) => {
	emitter.emit('set-server', state.server, val)
})

onMounted(async () => {
	let loadingInstance = ElLoading.service({
		fullscreen: true, body: true, lock: true,
		text: '正在连接服务器...'
	}) as any
	ws.onReady('main', async function (){
		loadingInstance.close()
		loadingInstance = undefined
		await connectSSH()
	}).onClose('main', function (){
		if (!loadingInstance){
			loadingInstance = ElLoading.service({ fullscreen: true, body: true, lock: true, text: '' }) as any
		}
		loadingInstance.setText('与服务器连接中断，正在重新连接...')
	})
	await ws.start()
	
	function createTerm(){
		term = new Terminal({
			rendererType: 'canvas',
			cursorBlink: true,
			convertEol: false, // 启用时，光标将设置为下一行的开头
			disableStdin: false, // 是否应禁用输入
			cursorStyle: 'bar'
		})
		term.loadAddon(fitAddon);
		term.open(document.getElementById('terminal-pane') as HTMLElement);
		fitAddon.fit();
		term.focus()
		term.writeln('Connecting...');
		term.onData(function (key: any){
			ws.sendSimple('shell.send', { id: uuid, action: 'input', data: key })
		})
	}
	
	window.addEventListener('resize', function (){
		try {
			fitAddon && fitAddon.fit()
		}catch {}
		try {
			ws.sendSimple('shell.send', { id: uuid, action: 'resize', data: { rows: term.rows, cols: term.cols } })
		}catch {}
	})
	
	function onConnect(){
		connected = true
		fitAddon.fit();
		term.writeln('connect success..')
		ws.sendSimple('shell.send', { id: uuid, action: 'resize', data: { rows: term.rows, cols: term.cols } })
	}
	
	async function connectSSH(){
		try {
			state.server = await ws.send('shell.getServerInfo', uuid)
		}catch(e: any) {
			alert('获取服务器信息失败:' + e.message)
			window.close()
			return
		}
		window.document.title = state.server.name + ' - ' + state.server.sys
		ws.on(uuid, function (body: any){
			const {event, data} = body
			if (event.startsWith('system.')){
				emitter.emit('system', data)
				Object.assign(state.systemInfo, data)
				if (event.endsWith('process')){
					setRunTime()
				}else if (event.endsWith('net')){
					getNetwork()
				}
			}
			switch (event){
				case 'error':
					term.writeln('connect error: ' + data)
					return;
				case 'exit':
					connected = false
					term.writeln('shell exit!')
					alert('与远程服务器的连接已断开')
					return;
				case 'data':
					if (!connected) {
						onConnect();
					}
					term.write(data)
					return;
			}
		})
		state.view = 'shell'
		state.ready = true
		await nextTick()
		createTerm()
		await ws.send('shell.start', uuid)
	}
})

const setRunTime = () => {
	if (!state.systemInfo.uptime) return
	state.runtime = calcTime(state.systemInfo.uptime)
}

const getNetwork = () => {
	if (state.systemInfo.network.length < 1) return
	const net = state.systemInfo.network.find(x => x.ip === state.server.host)
	if (!net) return
	state.downUp = '↓' + formatByteSizeToStr(net.up_speed) + '/s' +
		' '.repeat(15) +
		'↑' + formatByteSizeToStr(net.down_speed) + '/s'
}

const getMem = computed(() => {
	if (!state.systemInfo.mem || !state.systemInfo.mem['mem']) return 0
	return state.systemInfo.mem['mem'].ratio
})
</script>

<template>
	<icon-font></icon-font>
	<div class="header">
		<div class="title">
			<svg class="os-iconfont" aria-hidden="true">
				<use :xlink:href="getOSIcon(state.server.sys)"></use>
			</svg>
			{{ state.server.name }} - {{ state.server.sys }}
		</div>
		<el-radio-group v-model="state.view" size="large" style="line-height: 60px; position: absolute; left: 410px; top: 10px;">
			<el-radio-button label="shell">
				<i class="far fa-terminal"/> 终 端
			</el-radio-button>
			<el-radio-button label="sftp">
				<i class="far fa-folder"/> 文 件
			</el-radio-button>
			<el-radio-button label="monitor">
				<i class="far fa-monitor-heart-rate"/> 监 控
			</el-radio-button>
		</el-radio-group>
		<div class="right">
			<el-row>
				<el-col :span="12">
					<em>主机名: </em>
					<span>{{ state.systemInfo.hostname }}</span>
				</el-col>
				<el-col :span="12">
					<em>运行时间: </em>
					<span>{{ state.runtime }}</span>
				</el-col>
				<el-col :span="6">
					<em>CPU: </em>
					<span>{{ state.systemInfo.cpu }}%</span>
				</el-col>
				<el-col :span="6">
					<em>内存: </em>
					<span>{{ getMem }}%</span>
				</el-col>
				<el-col :span="12">
					<em>网络: </em>
					<span>{{ state.downUp }}</span>
				</el-col>
			</el-row>
		</div>
	</div>
	<template v-if="state.ready">
		<div v-show="state.view === 'shell'" class="content">
			<div id="terminal-pane" style="width: 100%; height: 100%; margin: 0; padding: 0;"></div>
		</div>
		<div v-show="state.view === 'sftp'" class="content" style="top: 60px;">
			<explorer></explorer>
		</div>
		<div v-show="state.view === 'monitor'" class="content" style="top: 60px;">
			<monitor></monitor>
		</div>
	</template>
</template>


<style>
.xterm .xterm-viewport {width: initial !important;}
.xterm { height: 100% !important; }
</style>

<style scoped lang="scss">
.header {
	position: absolute; left: 0; right: 0; top: 0;height: 59px; line-height: 59px;
	border-bottom: 1px solid #cccccc6b;
	.title {
		margin-left: 10px; line-height: 59px; width: 400px; display: inline-block;
	}
	.btn {
		margin-right: 10px; line-height: 59px;
	}
	.right {
		position: absolute;right: 0;top: 5px;bottom: 0; color: #5e5d5d; font-size: 7px; max-width: 520px; line-height: initial; cursor: default;
		span, em { display: inline-block; line-height: 22px; height: 22px;overflow: hidden;text-overflow:ellipsis;white-space: nowrap; }
		em { width: 70px;  }
		span { width: calc(100% - 70px); }
	}
}
.content {
	position: absolute; left: 0; right: 0; top: 59px; bottom: 0; margin: 0; padding: 0;
}
</style>