<script setup lang="ts">
import {watch, inject, reactive, computed, nextTick, ref} from 'vue'
import { FolderAdd, Upload, Search, Location, Refresh } from '@element-plus/icons-vue'
import WebSocketClient from "../lib/WebSocketClient";
import {IServer} from "../types";
import YLEventEmitter from "../lib/YLEventEmitter";
import { date_format, formatByteSizeToStr, copy, tip, deepClone } from '../Utils'
import axios from "axios";
import {ElLoading} from "element-plus/es";

const upload = ref<any>(null)
const uploadDir = ref<any>(null)
const ws = inject('ws') as WebSocketClient
const event = inject('event') as YLEventEmitter
type FileInfo = {
	path: string, type: string, name: string, power: string, powerNum: number, powerInfo: string,
	userGroup: string, mtime: number, atime: number, isDir: boolean, isFile: boolean, size: number,
	mode: number, attrs: { mode: number, gid: number, uid: number, size: number }
}
const tableView = ref<any>(null)
const state = reactive({
	searchValue: '',
	path: '/',
	queryFiles: [] as FileInfo[],
	server: {} as IServer,
	dialogVisible: false,
	form: {} as FileInfo,
	powerCheck: {
		user: { r: false, w: false, x: false },
		group: { r: false, w: false, x: false },
		other: { r: false, w: false, x: false }
	},
	userGroups: {} as {
		users: { id: number, name: string }[]
		groups: { id: number, name: string }[]
	},
	loading: false
})
let files = [] as FileInfo[]

function goBack(){
	if (state.path === '/') return
	const arr = state.path.split('/')
	arr.splice(arr.length - 1, 1)
	router('/' + arr.filter(x => !!x).join('/'))
}

let currentRow = undefined as undefined | FileInfo
function setCurrentRow(row: FileInfo){
	currentRow = row
	tableView.value.setCurrentRow(row)
}

function moveCurrentRow(down: boolean){
	if (!currentRow) {
		tableView.value.clearSort()
		state.queryFiles.length > 0 && setCurrentRow(state.queryFiles[0])
		return;
	}
	if (state.queryFiles.length === 1) return;
	const index = state.queryFiles.findIndex(x => x.path === currentRow!.path)
	let nIndex: number
	if (down){
		nIndex = index === state.queryFiles.length - 1 ? 0 : index + 1
	}else {
		nIndex = index === 0 ? state.queryFiles.length - 1 : index - 1
	}
	setCurrentRow(state.queryFiles[nIndex])
}

function handleKeyUp(e: KeyboardEvent){
	if ((e.target && (e.target as any).nodeName === 'input') || state.loading) return;
	if (e.code === 'Backspace'){
		if (state.searchValue.length > 0){
			state.searchValue = state.searchValue.substring(0, state.searchValue.length - 1)
		}else {
			goBack()
		}
	} else if (e.code === 'Enter'){
		currentRow && router(currentRow.path, currentRow)
	} else if (e.code === 'ArrowDown'){
		moveCurrentRow(true)
	} else if (e.code === 'ArrowUp'){
		moveCurrentRow(false)
	} else if (e.code === 'ArrowLeft'){
		goBack()
	} else if (e.key.length === 1){
		state.searchValue += e.key
	}
}

event.on('set-server', async function (server: IServer, type: string){
	window.removeEventListener('keyup', handleKeyUp)
	if (document.activeElement){
		try {
			(document.activeElement as HTMLElement).blur()
		}catch {}
	}
	if (type !== 'sftp') return
	window.addEventListener('keyup', handleKeyUp)
	if (state.path !== '/' || files.length > 0) return
	state.server = server
	await reloadFileList()
})

let queryTimeout = -1 as any;
watch(() => state.searchValue, (n) => {
	currentRow = undefined
	clearTimeout(queryTimeout)
	queryTimeout = setTimeout(function (){
		let res = files
		if (n){
			res = res.filter(x => x.name.includes(n))
		}
		state.queryFiles = res.sort((a, b) => b.powerNum - a.powerNum)
		tableView.value.clearSort()
		nextTick(function (){
			if (state.queryFiles.length > 0){
				setCurrentRow(state.queryFiles[0])
			}
		})
	}, state.queryFiles.length < 50 ? 150 : 300)
})

function onCurrentChange(row: FileInfo){
	currentRow = row
}

const routerList = computed(() => {
	if (state.path === '/') return []
	const res = []
	let curPath = ''
	for (const item of state.path.split('/').filter(x => !!x)){
		curPath = curPath + '/' + item
		res.push({ name: item, path: curPath })
	}
	return res
})

function getFileLongnameType(longname: string): string{
	return ({
		'-': '普通文件', 'd': '目录', 'l': '链接文件', 'p': '管理文件',
		'b': '块设备文件', 'c': '字符设备文件', 's': '套接字文件'
	} as any)[longname[0] as any]
}

function parsePowerStr(item: any): string {
	const powerStr = item.longname.substring(0, 9)
	const arr = item.longname.replaceAll('\t', ' ').split(' ').filter((x: string) => !!x) as string[]
	let powerInfo = '<p>权限代码: ' + item.attrs.mode +'</p><p>文件类型：'
	powerInfo += getFileLongnameType(powerStr)  + '</p>'
	const mode = item.attrs.mode
	powerInfo += '<p>拥有者[' + arr[2] + ']权限：'
	powerInfo += (mode & 0b100000000) === 0b100000000 ? '可读' : '不可读'
	powerInfo += '/' + ((mode & 0b10000000) === 0b10000000 ? '可写' : '不可写')
	powerInfo += '/' + ((mode & 0b1000000) === 0b1000000 ? '可执行' : '不可执行')
	powerInfo += '</p>'
	powerInfo += '<p>组[' + arr[3] + ']权限：'
	powerInfo += (mode & 0b100000) === 0b100000 ? '可读' : '不可读'
	powerInfo += '/' + ((mode & 0b10000) === 0b10000 ? '可写' : '不可写')
	powerInfo += '/' + ((mode & 0b1000) === 0b1000 ? '可执行' : '不可执行')
	powerInfo += '</p>'
	powerInfo += '<p>其他用户权限：'
	powerInfo += (mode & 0b100) === 0b100 ? '可读' : '不可读'
	powerInfo += '/' + ((mode & 0b10) === 0b10 ? '可写' : '不可写')
	powerInfo += '/' + ((mode & 0b1) === 0b1 ? '可执行' : '不可执行')
	powerInfo += '</p>'
	return powerInfo
}

async function reloadFileList(){
	currentRow = undefined
	state.loading = true
	try {
		const res = await ws.send('webssh.readdir', { path: state.path, id: state.server.id })
		const list = [] as FileInfo[]
		for (const item of res){
			const type = item.longname[0]
			const isDir = type === 'd'
			const arr = item.longname.replaceAll('\t', ' ').split(' ').filter((x: string) => !!x) as string[]
			const powerNum = ['-', 's', 'c', 'b', 'p', 'l', 'd'].findIndex(x => x === type) * 10000 + (item.attrs.mode & 0b111111111)
			list.push({
				path: (state.path === '/' ? '/' : state.path + '/') + item.filename,
				type: getFileLongnameType(item.longname),
				name: item.filename, userGroup: arr[2] + '/' + arr[3],
				power: arr[0], powerNum, powerInfo: parsePowerStr(item),
				atime: item.attrs.atime, mtime: item.attrs.mtime,
				isDir, isFile: type === '-', mode: item.attrs.mode,
				size: isDir ? 0 : item.attrs.size, attrs: item.attrs
			})
		}
		state.queryFiles = files = list.sort((a, b) => b.powerNum - a.powerNum)
		state.queryFiles.length > 0 && setCurrentRow(state.queryFiles[0])
	}finally {
		state.loading = false
	}
}

function router(path: string, fileInfo?: FileInfo){
	if (fileInfo && fileInfo.isFile){
		window.open(`${ window.location.origin }/server/download?id=${ state.server.id }&path=${ encodeURI(path) }`)
		return
	}
	if (!fileInfo || (fileInfo && fileInfo.isDir)){
		state.searchValue = ''
		state.path = path
		reloadFileList()
	}
}

async function onGotoPath(){
	const path = await tip.prompt('请输入路径', '跳转', '')
	if (!path.trim()) return
	router(path)
}

async function onMkdir(){
	const name = await tip.prompt('请输入目录名称', '新建目录', '')
	if (!name.trim()) return
	if (files.find(x => x.name === name)) {
		return tip.error('目录名称已存在')
	}
	await ws.send('webssh.mkdir', { id: state.server.id, name })
	await reloadFileList()
}

async function onRename(row: FileInfo) {
	if (!await tip.confirm('该操作存在风险，请确认是否重命名该文件/文件夹？', 'warning')) return
	let name = await tip.prompt('请输入文件名', '重命名', row.name)
	name = name.trim()
	if (!name.trim()) return
	if (name === row.name) return tip.warn('名称相同')
	if (files.find(x => x.name === name)) {
		return tip.error('名称已存在')
	}
	await ws.send('webssh.move', { id: state.server.id, path: row.path, name })
	await reloadFileList()
}

async function onDelete(row: FileInfo) {
	if (!await tip.confirm('该操作存在风险，请确认是否删除该文件/文件夹？', 'warning')) return
	await ws.send('webssh.remove', { id: state.server.id, path: row.path })
	await reloadFileList()
}

async function onExitPower(row: FileInfo){
	Object.assign(state.userGroups, await ws.send('webssh.getUserGroups', state.server.id))
	Object.assign(state.form, deepClone(row))
	const mode = row.mode
	state.powerCheck.user.r = (mode & 0b100000000) === 0b100000000
	state.powerCheck.user.w = (mode & 0b10000000) === 0b10000000
	state.powerCheck.user.x = (mode & 0b1000000) === 0b1000000
	
	state.powerCheck.group.r = (mode & 0b100000) === 0b100000
	state.powerCheck.group.w = (mode & 0b10000) === 0b10000
	state.powerCheck.group.x = (mode & 0b1000) === 0b1000
	
	state.powerCheck.other.r = (mode & 0b100) === 0b100
	state.powerCheck.other.w = (mode & 0b10) === 0b10
	state.powerCheck.other.x = (mode & 0b1) === 0b1
	state.dialogVisible = true
}

function onSelectFile(dir: boolean = false){
	(dir ? uploadDir : upload).value.click()
}

function onUploadFiles(e: any){
	const { target } = e
	if (!target || !target.files || target.files.length < 1) return
	const fd = new FormData()
	fd.append('id', state.server.id + '')
	fd.append('path', state.path)
	for (const item of e.target.files){
		fd.append("attachment", item);
	}
	const loadingInstance = ElLoading.service({
		fullscreen: true, body: true, lock: true,
		text: '正在上传文件，请稍后...'
	}) as any
	axios.post('/server/upload', fd).then((res) => {
		loadingInstance.close()
		if (res.data?.success){
			tip.success('上传文件成功')
			reloadFileList()
		}else if (res.data?.msg){
			tip.error('上传文件时发生错误:' + JSON.stringify(res.data.msg))
		}else {
			tip.error('上传文件时发生未知错误')
		}
	}).catch(e => {
		loadingInstance.close()
		tip.error('上传文件时发生错误:' + e.message)
	})
}

</script>

<template>
	<div class="header">
		<ol class="breadcrumb">
			<el-icon style="line-height: 30px; height: 30px; margin-right: 10px;"><i-position /></el-icon>
			<li class="breadcrumb-item">
				<a href="#" @click="router('/')">/{{ state.server.name }}</a>
			</li>
			<li v-for="(item, index) in routerList" :key="index" :class="{ active: index === routerList.length - 1 }" class="breadcrumb-item">
				<span v-if="index === routerList.length - 1">{{ item.name }}</span>
				<a v-else href="#" @click="router(item.path)">{{ item.name }}</a>
			</li>
		</ol>
	</div>
	<div class="header-right">
		<div class="btn-group">
			<el-button :icon="FolderAdd" style="margin-left: 10px;" @click="onMkdir">新建目录</el-button>
			<el-button :icon="Upload" @click="onSelectFile(false)">上传文件</el-button>
			<el-button @click="onSelectFile(true)">
				<el-icon><svg class="icon" aria-hidden="true"><use xlink:href="#icon-upfolder"></use></svg></el-icon>
				<span style="margin-left: 5px;">上传文件夹</span>
			</el-button>
			<el-button :icon="Location" @click="onGotoPath">跳转</el-button>
			<span style="margin-left: 10px; color: red;">1. 点击权限列可编辑权限、2. 支持键盘操作、3. 重命名、删除操作前请自行确认，误操作可能导致数据丢失</span>
			<input ref="upload" type="file" multiple @change="onUploadFiles" style="display: none;"/>
			<input ref="uploadDir" type="file" webkitdirectory multiple @change="onUploadFiles" style="display: none;"/>
		</div>
		<div class="btn-group2">
			<el-button :icon="Refresh" circle @click="reloadFileList" title="刷新"></el-button>
			<el-input v-model="state.searchValue" :prefix-icon="Search" style="width: 300px;margin-left: 10px;" placeholder="搜索文件" clearable/>
		</div>
	</div>
	<div class="table-responsive">
		<el-table :data="state.queryFiles" ref="tableView" row-key="path" style="width: 100%"
		          border highlight-current-row height="100%" @current-change="onCurrentChange" v-loading="state.loading">
			<el-table-column prop="powerNum" label="权限" sortable width="120" align="center">
				<template #default="{ row }">
					<el-tooltip placement="bottom">
						<template #content><div v-html="row.powerInfo"></div></template>
						<span style="cursor: pointer;" @click="onExitPower(row)">{{ row.power }}</span>
					</el-tooltip>
				</template>
			</el-table-column>
			<el-table-column prop="userGroup" label="用户/组" sortable width="120" align="center"/>
			<el-table-column prop="type" label="类型" sortable width="120" align="center"/>
			<el-table-column prop="name" label="文件名" sortable show-overflow-tooltip>
				<template #default="{ row }">
					<el-icon v-if="row.isDir" color="#E6A23C"><i-folder /></el-icon>
					<el-icon v-else><i-document /></el-icon>
					<a v-if="row.isFile || row.isDir" href="#" @click.stop="router(row.path, row)" style="margin-left: 10px;">
						{{ row.name }}
					</a>
					<span v-else style="margin-left: 10px;">{{ row.name }}</span>
				</template>
			</el-table-column>
			<el-table-column prop="size" label="文件大小" sortable width="200" align="center">
				<template #default="{ row }">{{ row.size === 0 ? '-' : formatByteSizeToStr(row.size) }}</template>
			</el-table-column>
			<el-table-column prop="mtime" label="最后修改时间" sortable width="200" align="center">
				<template #default="{ row }">{{ date_format(row.mtime * 1000) }}</template>
			</el-table-column>
			<el-table-column prop="atime" label="最后访问时间" sortable width="200" align="center">
				<template #default="{ row }">{{ date_format(row.atime * 1000) }}</template>
			</el-table-column>
			<el-table-column label="操作" width="200" align="center">
				<template #default="{ row }">
					<el-button type="text" @click="copy(row.path)">复制路径</el-button>
					<el-button type="text" style="color: #E6A23C;" @click="onRename(row)">重命名</el-button>
					<el-button type="text" style="color: #F56C6C;" @click="onDelete(row)">删除</el-button>
				</template>
			</el-table-column>
		</el-table>
	</div>
	<el-dialog title="编辑权限" v-model="state.dialogVisible" width="500px" center custom-class="shell-dialog">
		<el-form ref="formRef" :model="state.form" label-width="150px">
			<el-form-item label="文件名称" prop="name">
				{{ state.form.name }}
			</el-form-item>
			<el-form-item label="所属用户">
				<el-select v-model="state.form.attrs.uid" filterable>
					<el-option v-for="item in state.userGroups.users" :key="item.name" :label="item.name" :value="item.id"></el-option>
				</el-select>
			</el-form-item>
			<el-form-item label="所属组">
				<el-select v-model="state.form.attrs.gid" filterable>
					<el-option v-for="item in state.userGroups.groups" :key="item.name" :label="item.name" :value="item.id"></el-option>
				</el-select>
			</el-form-item>
			<el-form-item label="拥有者">
				<el-checkbox v-model="state.powerCheck.user.r" label="读"></el-checkbox>
				<el-checkbox v-model="state.powerCheck.user.w" label="写"></el-checkbox>
				<el-checkbox v-model="state.powerCheck.user.x" label="执行"></el-checkbox>
			</el-form-item>
			<el-form-item label="组">
				<el-checkbox v-model="state.powerCheck.group.r" label="读"></el-checkbox>
				<el-checkbox v-model="state.powerCheck.group.w" label="写"></el-checkbox>
				<el-checkbox v-model="state.powerCheck.group.x" label="执行"></el-checkbox>
			</el-form-item>
			<el-form-item label="其他用户">
				<el-checkbox v-model="state.powerCheck.other.r" label="读"></el-checkbox>
				<el-checkbox v-model="state.powerCheck.other.w" label="写"></el-checkbox>
				<el-checkbox v-model="state.powerCheck.other.x" label="执行"></el-checkbox>
			</el-form-item>
			
		</el-form>
		<template #footer>
			<el-button @click="state.dialogVisible = false" size="medium">取 消</el-button>
			<el-button type="primary" @click="onSave" size="medium">保 存</el-button>
		</template>
	</el-dialog>
</template>

<style scoped lang="scss">
dl, ol, ul {margin-top: 0;}
.header {
	line-height: 30px; border-bottom: 1px solid #cccccc6b;
}
.header-right {
	.btn-group,.btn-group2{ display:flex; justify-content: space-between; align-items: center; }
	display:flex; justify-content: space-between; align-items: center; line-height: 30px; padding: 12px 10px 12px 0; background-color: #e9ecef38;
}
.breadcrumb {
	height: 30px; line-height: 30px;display: flex;margin: 0;
	-ms-flex-wrap: wrap;flex-wrap: wrap;padding: 5px 10px;
	list-style: none;background-color: #e9ecef38;border-radius: 10px;
}
.breadcrumb-item+.breadcrumb-item {padding-left: .5rem;}
.breadcrumb-item+.breadcrumb-item:before {display: inline-block;padding-right: .5rem;color: #6c757d;content: "/";}
.breadcrumb-item.active {color: #6c757d;}

.table-responsive {border-collapse: collapse;color: #212529; padding: 0 10px 10px 10px; display: block;height: calc(100% - 107px);}

</style>