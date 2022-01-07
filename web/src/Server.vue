<script setup lang="ts">
import {nextTick, reactive, ref, inject} from 'vue'
import {IServer,ServerState} from './types'
import {copy, deepClone, formValidate, resetForm, tip, getOSIcon} from './Utils'
import WebSocketClient from "./lib/WebSocketClient";

const rules = reactive({
	name: [{ required: true, message: '请输入服务器名称', trigger: 'blur' }],
	host: [{ required: true, message: '请输入服务器地址',  trigger: 'blur' }],
	port: [{ required: true, message: '请输入合法的服务器端口', type: 'number', trigger: 'blur', Range: { min: 22, max: 65535 } }],
	user: [{ required: true, message: '请输入用户名称', trigger: 'blur' }],
	pwd: [{ required: true, message: '请输入密码', trigger: 'blur' }],
})

const ServerJson = {
	id: '', name: '', host: '', port: 22, user: '', pwd: '',
	sys: '-', arch: '-', cpu: '-', mem: '-', disk: '-', state: ServerState.not_connect
} as IServer

const formRef = ref<any>()
const state = reactive({
	list: [] as IServer[],
	form: deepClone(ServerJson) as IServer,
	dialogVisible: false,
})

const ws = inject('ws') as WebSocketClient
ws.onReady('server', reload)
ws.on('server.refresh', function (item: any){
	if (!item.id) return
	const index = state.list.findIndex(x => x.id === item.id)
	if (index === -1) return;
	Object.assign(state.list[index], item)
	
}).on('webssh.createWEBSSH', function (msg: any){
	let id = msg.id
	if (!msg || !id) return
	ws.on(id, function handleReady(body: {event: string, data: any}){
		if (body.event !== 'ready') return
		ws.off(id, handleReady)
		window.open(window.location.origin + '/webssh.html?uuid=' + id)
	})
})

async function reload() {
	const res = await ws.send('server.query')
	state.list.splice(0, state.list.length)
	state.list.push(...res.map((x: any) => {
		x.icon = getOSIcon(x.sys)
		return x
	}))
}

function clear(){
	state.form = deepClone(ServerJson)
	nextTick(() => resetForm(formRef.value))
}

function onNew(){
	clear()
	state.dialogVisible = true
}

function onEdit(row: IServer){
	state.form = deepClone(row)
	state.dialogVisible = true
}

function onCopy(row: IServer){
	state.form = deepClone(row)
	Object.assign(state.form, { id: '', sys: '-', arch: '-', cpu: '-', mem: '-', disk: '-', state: ServerState.not_connect })
	state.dialogVisible = true
}

async function onDelete(row: IServer){
	if (!await tip.confirm('是否确认删除该服务器?', 'warning')) return
	const res = await ws.send('server.remove', row.id)
	tip[res ? 'success': 'error'](`删除服务器${ res ? '成功': '失败' }`)
	await reload()
}

function onCopyServer(row: IServer) {
	copy(`${ row.user }@${ row.host } -p ${ row.port }`)
}

async function onSave(){
	if (!await formValidate(formRef.value)) return
	const ipReg = /^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])$/
	const domainReg = /^(?=^.{3,255}$)[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+$/
	if (!ipReg.test(state.form.host) && !domainReg.test(state.form.host)){
		tip.error('服务器地址不是IPv4或域名格式，请重新输入')
		return
	}
	const obj = deepClone(state.form)
	let url = 'update'
	if (!obj.id){
		if (state.list.find(x => x.name === obj.name)) return tip.error('服务器名称重复')
		if (state.list.find(x => x.host === obj.host && x.port === obj.port && x.user === obj.user)){
			return tip.warn('该服务器已存在')
		}
		url = 'insert'
	}
	const res = !!await ws.send('server.' + url, obj)
	tip[res ? 'success': 'error'](`${ obj.id ? '修改' : '添加' }服务器${ res ? '成功': '失败' }`)
	state.dialogVisible = false
	await reload()
}

async function onRefreshInfo(row: IServer){
	ws.send('server.refreshSysInfo', row ? row.id : undefined).catch(() => {})
}

function getColor(row: IServer){
	if (row.state === '未连接'){
		return '#909399'
	}else if (row.state === '连接正常'){
		return '#67C23A'
	}
	return '#F56C6C'
}

function onOpenSSH(serverId: string){
	ws.send('webssh.requestWEBSSH', serverId)
}

</script>

<template>
	<div style="margin: 10px;">
		<el-button type="primary" @click="onNew">添加服务器</el-button>
		<el-button type="primary" @click="onRefreshInfo">刷新服务器信息</el-button>
	</div>
	<div style="width: 100%; height: calc(100% - 60px);">
		<el-scrollbar height="100%">
			<el-table :data="state.list" :default-sort="{ prop: 'state', order: 'ascending' }" style="width: 100%" size="small" border highlight-current-row>
				<el-table-column type="index" label="序号" sortable width="50" align="center"></el-table-column>
				<el-table-column prop="name" label="服务器名称" sortable align="center" show-overflow-tooltip>
					<template #default="{row}">
						<el-button type="text" v-if="row.state === ServerState.success" @click="onOpenSSH(row.id)">{{ row.name }}</el-button>
						<span v-else>{{ row.name }}</span>
					</template>
				</el-table-column>
				<el-table-column prop="host" label="服务器地址" sortable align="center" width="220" show-overflow-tooltip>
					<template #default="{row}">
						<span style="cursor: pointer;" @click="onCopyServer(row)">
							{{ row.user }}@{{ row.host }} -p {{ row.port }}
						</span>
					</template>
				</el-table-column>
				<el-table-column prop="sys" label="操作系统" sortable align="center" width="250" show-overflow-tooltip>
					<template #default="{row}">
						<template v-if="row.sys !== '-'">
							<svg class="os-iconfont" aria-hidden="true">
								<use :xlink:href="row.icon"></use>
							</svg>
						</template>
						{{ row.sys }}
					</template>
				</el-table-column>
				<el-table-column prop="arch" label="架构" sortable align="center" width="120"/>
				<el-table-column prop="cpu" label="CPU" sortable align="center" width="100"/>
				<el-table-column prop="mem" label="内存" sortable align="center" width="100"/>
				<el-table-column prop="disk" label="磁盘空间" sortable align="center" width="100"/>
				<el-table-column prop="state" label="状态" sortable align="center" width="150" show-overflow-tooltip>
					<template #default="{ row }">
						<div :style="{ color: getColor(row) }">
							{{ row.state }}
							<el-icon v-if="row.state === ServerState.connecting" class="is-loading"><i-loading/></el-icon>
							<el-icon v-else style="cursor: pointer" title="刷新状态" @click="onRefreshInfo(row)"><i-refresh /></el-icon>
						</div>
					</template>
				</el-table-column>
				<el-table-column label="操作" align="center" width="200">
					<template #default="{ row }">
						<el-button type="text" @click="onEdit(row)">编辑</el-button>
						<el-button type="text" @click="onCopy(row)" style="color: #E6A23C;">复制</el-button>
						<el-button type="text" style="color: #F56C6C;" @click="onDelete(row)">删除</el-button>
					</template>
				</el-table-column>
			</el-table>
		</el-scrollbar>
	</div>
	<el-dialog :title="state.form.id ? '编辑服务器' : '添加服务器'" v-model="state.dialogVisible" width="700px"
	           @close="clear" :close-on-click-modal="!!state.form.id" center custom-class="shell-dialog">
		<div style="width: 65%; margin: 0 auto;">
			<el-form ref="formRef" :model="state.form" :rules="rules" label-width="150px">
				<el-form-item label="服务器名称" prop="name">
					<el-input v-model="state.form.name" placeholder="请输入服务器名称" size="medium"></el-input>
				</el-form-item>
				<el-form-item label="服务器地址" prop="host">
					<el-input v-model="state.form.host" placeholder="请输入服务器地址" size="medium"></el-input>
				</el-form-item>
				<el-form-item label="服务器端口" prop="port">
					<el-input v-model.number="state.form.port" placeholder="请输入服务器端口" size="medium" type="number"></el-input>
				</el-form-item>
				<el-form-item label="用户名" prop="user">
					<el-input v-model="state.form.user" placeholder="请输入用户名" size="medium"></el-input>
				</el-form-item>
				<el-form-item label="密码" prop="pwd">
					<el-input v-model="state.form.pwd" type="password" show-password placeholder="请输入密码" size="medium"></el-input>
				</el-form-item>
			</el-form>
		</div>
		<template #footer>
			<el-button @click="state.dialogVisible = false" size="medium">取 消</el-button>
			<el-button type="primary" @click="onSave" size="medium">保 存</el-button>
		</template>
	</el-dialog>

</template>