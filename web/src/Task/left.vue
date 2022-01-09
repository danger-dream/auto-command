<script setup lang="ts">
import {inject, reactive, ref} from 'vue'
import WebSocketClient from "../lib/WebSocketClient";
import {TreeNode, TreeNodeType} from "../types";
import type Node from 'element-plus/es/components/tree/src/model/node'
import UploadView from '../components/Upload.vue'
import {tip} from "../Utils";

const ws = inject('ws') as WebSocketClient
const tree = ref<any>(null)
const upload = ref<any>(null)
const state = reactive({
	searchValue: '',
	nodes: [] as TreeNode[],
	currentNode: undefined as undefined | TreeNode
})

const props = { label: 'label', children: 'children', isLeaf: 'leaf' }

function task2TreeNode(x: any): TreeNode {
	return { id: x.id, label: x.name, type: TreeNodeType.task, source: x, children: [], path: '/', tid: x.id }
}

function file2TreeNode(x: any, tid?: string): TreeNode {
	const res = { id: x.path, label: x.name, type: x.dir ? TreeNodeType.dir : TreeNodeType.file, source: x, path: x.path, tid } as TreeNode
	if (x.dir) {
		res.children = []
	}else {
		res.leaf = true
	}
	return res
}

async function loadResources(tn: TreeNode): Promise<TreeNode[]>{
	let path = tn.path
	let id = ''
	if (tn.type === TreeNodeType.task){
		id = tn.id
	}else if (tn.tid){
		id = tn.tid
	}
	const res = await ws.send('resources.list', { path, id }) as any[]
	return res.map(x => file2TreeNode(x)).sort((a, b) => {
		if (a.source.dir && b.source.dir){
			return a.label.localeCompare(b.label)
		}else {
			let an = a.source.dir ? 1: -1
			let bn = b.source.dir ? 1: -1
			return bn - an
		}
	})
}

const rootNodeFN = { node: {} as Node, resolve: (_: TreeNode[]) => {} }
async function loadNode(node: Node, resolve: (data: TreeNode[]) => void) {
	const tn = node.data as TreeNode
	if (tn.type === TreeNodeType.file) return resolve([])
	if (node.level === 0){
		rootNodeFN.node = node
		rootNodeFN.resolve = resolve
		const taks = await ws.send('resources.loadTasks') as any[]
		const result = [] as TreeNode[]
		result.push({ id: 'public', label: '公共资源', type: TreeNodeType.public, path: '/' } as any)
		result.push(...taks.map(x => task2TreeNode(x)))
		tree.value.setCurrentKey(null)
		return resolve(result)
	}
	resolve(await loadResources(tn))
}

function filterNode(){

}

function getNodeClass(data: TreeNode){
	return { 0: 'far fa-cloud', 1: 'far fa-folder', 2: 'far fa-file', 3: 'far fa-cubes' }[data.type]
}

function getNodeColor(data: TreeNode){
	return { 0: '#67C23A', 1: '#E6A23C', 2: '', 3: '#409EFF' }[data.type]
}

function handleCommand(command: string){
	const node = state.currentNode
	if (!node) return
	let id = node.type === TreeNodeType.task ? node.id : (node.tid || '')
	upload.value.selectFile(command === 'dir', '/resources/upload', { id, path: node.path }, function (e?: Error){
		if (e) return
		let n = tree.value.getNode(state.currentNode)
		n.loaded = false
		n.expand()
	})
}

type BtnAction = 'task' | 'mkdir' | 'upload' | 'rename' | 'delete' | 'refresh'
async function onBtnClick(action: BtnAction){
	if (isDisable(action)) return
	if (action === 'task'){
		//  todo create task
		return
	} else if (action === 'refresh'){
		rootNodeFN.node.childNodes = []
		loadNode(rootNodeFN.node, rootNodeFN.resolve).then(() => {})
		return
	} else if (action === 'upload'){
		handleCommand('')
		return
	}
	if (!state.currentNode) return;
	const node = state.currentNode
	let title = { mkdir: '新建目录', rename: '重命名', delete: '删除' }[action]
	let id = node.type === TreeNodeType.task ? node.id : (node.tid || '')
	let res = false
	try {
		switch (action){
			case 'mkdir':
				const name = await tip.prompt('请输入目录名称', title)
				if (!name) return
				res = await ws.send('resources.mkdir', { id, path: node.path, name })
				if (res){
					let n = tree.value.getNode(state.currentNode)
					n.loaded = false
					n.expand()
				}
				break
			case 'rename':
				const newName = await tip.prompt('请输入新名称', title, node.label)
				if (!newName) return
				if (node.type === TreeNodeType.task){
					title += '任务'
					res = await ws.send('resources.saveTask', { id, name: newName })
				}else {
					res = await ws.send('resources.rename', { id, path: node.path, name: newName })
				}
				if (res){
					node.source.name = newName
					node.label = newName
				}
				break
			case 'delete':
				title = { 0: '', 1: '目录', 2: '文件', 3: '任务', }[node.type]
				if (!await tip.confirm(`是否确定删除${ node.label }${ title }?`, 'warning')) return
				res = await ws.send('resources.remove', { id, path: node.path })
				title = '删除' + title
				if (res){
					tree.value.remove(tree.value.getNode(state.currentNode))
				}
				break
		}
		tip[res ? 'success': 'error'](title + (res ? '成功': '失败'))
	}catch (e: any) {
		tip.error(title + '时发生错误:' + e.message)
	}
}

function isDisable(type: BtnAction): boolean {
	switch (type){
		case 'mkdir':
		case 'upload': return !state.currentNode || state.currentNode.type === TreeNodeType.file
		case 'rename':
		case "delete":return !state.currentNode || state.currentNode.type === TreeNodeType.public
		default: return false
	}
}

</script>

<template>
	<upload-view ref="upload"/>
	<header>
		<el-input v-model="state.searchValue" placeholder="输入查找" style="width: 100%;margin-bottom: 1px;">
			<template #prefix>
				<el-icon class="el-input__icon"><i-search /></el-icon>
			</template>
		</el-input>
		<div class="header-btn-box" style='margin: 5px 0;'>
			<el-tooltip effect="light" content="创建任务" info:enterable="false" placement="bottom" :show-after="400" transition=" ">
				<i @click="onBtnClick('task')" class="far fa-cubes" :class="{ disabled: isDisable('task') }"></i>
			</el-tooltip>
			<el-tooltip effect="light" content="新建目录" info:enterable="false" placement="bottom" :show-after="400" transition=" ">
				<i @click="onBtnClick('mkdir')" class="far fa-folder" :class="{ disabled: !state.currentNode }"></i>
			</el-tooltip>
			<el-dropdown @command="handleCommand">
				<i @click="onBtnClick('upload')" class="far fa-upload" :class="{ disabled: !state.currentNode }"></i>
				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item command="file">上传文件</el-dropdown-item>
						<el-dropdown-item command="dir">上传目录</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
			<el-tooltip effect="light" content="重命名" info:enterable="false" placement="bottom" :show-after="400" transition=" ">
				<i @click="onBtnClick('rename')" class="far fa-edit" :class="{ disabled: !state.currentNode }"></i>
			</el-tooltip>
			<el-tooltip effect="light" content="删除" info:enterable="false" placement="bottom" :show-after="400" transition=" ">
				<i @click="onBtnClick('delete')" class="fal fa-trash" :class="{ disabled: !state.currentNode || state.currentNode?.id === 'public' }"></i>
			</el-tooltip>
			<div class="right">
				<el-tooltip effect="light" content="刷新" info:enterable="false" placement="bottom" :show-after="200" transition=" ">
					<i @click="onBtnClick('refresh')" class="fas fa-sync-alt" style="margin-left: 5px;"></i>
				</el-tooltip>
			</div>
		</div>
	</header>
	<div class="sidebar-tree-box" @contextmenu.prevent="() => {return false}">
		<el-scrollbar style='height: 100%;'>
			<el-tree class="sidebar-tree" :props="props" :load="loadNode" lazy node-key="id" highlight-current ref="tree"
			         @current-change="(n) => state.currentNode = n" :expand-on-click-node="false" :filter-node-method="filterNode">
				<template #default="{ node, data }">
					<div class="sidebar-tree-node">
						<i :class="getNodeClass(data)" :style="{ color: getNodeColor(data) }"></i>
						<span>{{ node.label }}</span>
					</div>
				</template>
			</el-tree>
		</el-scrollbar>
	</div>
</template>

<style lang="scss">
.sidebar-tree {
	& .el-tree-node__content {
		height: 35px;border-radius: 5px;
		& .el-tree-node__expand-icon { font-size: 15px;  }
	}
}
.header-btn-box {
	line-height: 30px; height: 30px; width: 100%;
	i {
		font-size: 20px;color: #797979;cursor: pointer;padding: 5px; border-radius: 4px; margin-right: 5px;
		&:hover { color: rgba(225, 113, 23, 1) }
		&:active { color: rgba(225, 113, 23, 1) }
		&.disabled {
			color: rgb(189,189,189); cursor: default;
			&:hover { background-color: initial; }
			&:active { background-color: initial; }
		}
		&:last-child {
			margin-right: 0;
		}
	}
	.info {
		margin-right: 25px; padding-right:25px; cursor: pointer; border-right: 1px solid #ddd;
		span {font-size: 16px;}
		&:hover { i, span { color: rgba(225, 113, 23, 1) } }
		&:active { i, span { color: rgba(225, 113, 23, 1) } }
	}
	.right {
		display: inline-block; height: 100%; float: right;
		
		.header-btn-search {
			width: 250px;
			height: 30px;
			line-height: 30px;
			border: none;
			border-left: 1px solid #e4e7ed;
			border-right: 1px solid #e4e7ed;
			border-radius: 0;
			.el-input__inner { height: 30px;line-height: 30px;border: none; }
		}
	}
}
</style>

<style scoped lang="scss">
header {padding: 10px 15px 0;height: 75px;border-bottom: 1px solid #6f6d6d1c;}

.sidebar-tree-box {
	height: calc(100% - 75px);padding: 10px;
	
	.sidebar-tree {
		.sidebar-tree-node {
			line-height: 35px; height: 35px;
			i { font-size: 20px; width: 25px; margin-right: 5px; color: #8d8d8d; }
			span { font-size: 17px; padding-top: 2px; color: #333333; }
		}
	}
}
</style>