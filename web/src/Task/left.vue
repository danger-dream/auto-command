<script setup lang="ts">
import {inject, onMounted, reactive} from 'vue'
import WebSocketClient from "../lib/WebSocketClient";
import {TreeNode, TreeNodeType} from "../types";

const ws = inject('ws') as WebSocketClient
const state = reactive({
	searchValue: '',
	nodes: [] as TreeNode[]
})

async function reloadTreeNodes(){
	state.nodes.push(...[
		{
			id: 'public', label: 'public', type: TreeNodeType.public,
			source: {}, children: [
				{ id: 'dir-' + Date.now(), label: 'test', type: TreeNodeType.dir, source: {}, children: [], router: false },
				{ id: 'dir-' + Date.now(), label: 'a1', type: TreeNodeType.dir, source: {}, children: [], router: false },
				{ id: 'dir-' + Date.now(), label: 'b2', type: TreeNodeType.dir, source: {}, children: [], router: false },
				{ id: 'file-' + Date.now(), label: 'xxx.img', type: TreeNodeType.file, source: {}, children: [], router: false },
			], router: false
		} as TreeNode,
		{
			id: 'task-' + Date.now(), label: '初始化centos', type: TreeNodeType.task,
			source: {}, children: [], router: true
		} as TreeNode,
		{
			id: 'task-1' + Date.now(), label: '安装NTP', type: TreeNodeType.task,
			source: {}, children: [], router: true
		} as TreeNode,
		{
			id: 'task-2' + Date.now(), label: '安装Docker', type: TreeNodeType.task,
			source: {}, children: [], router: true
		} as TreeNode,
		{
			id: 'task-3' + Date.now(), label: '安装DockerCompose', type: TreeNodeType.task,
			source: {}, children: [], router: true
		} as TreeNode
	])
}

onMounted(function (){
	ws.onReady('task.left', function (){
		reloadTreeNodes()
	})
})

function onCurrentChange(){

}

function filterNode(){

}

function getNodeClass(data: TreeNode){
	return { 0: 'far fa-cloud', 1: 'far fa-folder', 2: 'far fa-file', 3: 'far fa-cubes' }[data.type]
}

function getNodeColor(data: TreeNode){
	return { 0: '#67C23A', 1: '#E6A23C', 2: '', 3: '#409EFF' }[data.type]
}

function onBtnClick(action: string){

}

</script>

<template>
	<header>
		<el-input v-model="state.searchValue" placeholder="输入查找" style="width: 100%;margin-bottom: 1px;">
			<template #prefix>
				<el-icon class="el-input__icon"><i-search /></el-icon>
			</template>
		</el-input>
		<div class="header-btn-box" style='margin: 5px 0;'>
			<el-tooltip effect="light" content="创建任务" :visible-arrow="false" :enterable="false" placement="bottom" :show-after="400" transition=" ">
				<i @click="onBtnClick('task')" class="far fa-cubes"></i>
			</el-tooltip>
			<el-tooltip effect="light" content="新建目录" :visible-arrow="false" :enterable="false" placement="bottom" :show-after="400" transition=" ">
				<i @click="onBtnClick('mkdir')" class="far fa-folder"></i>
			</el-tooltip>
			<el-tooltip effect="light" content="上传目录/文件" :visible-arrow="false" :enterable="false" placement="bottom" :show-after="400" transition=" ">
				<i @click="onBtnClick('upload')" class="far fa-upload"></i>
			</el-tooltip>
			<el-tooltip effect="light" content="重命名" :visible-arrow="false" :enterable="false" placement="bottom" :show-after="400" transition=" ">
				<i @click="onBtnClick('rename')" class="far fa-edit"></i>
			</el-tooltip>
			<el-tooltip effect="light" content="删除" :visible-arrow="false" :enterable="false" placement="bottom" :show-after="400" transition=" ">
				<i @click="onBtnClick('delete')" class="fal fa-trash"></i>
			</el-tooltip>
			
			<div class="right">
				<el-tooltip effect="light" content="刷新" :visible-arrow="false" :enterable="false" placement="bottom" :show-after="200" transition=" ">
					<i @click="onBtnClick('refresh')" class="fas fa-sync-alt" style="margin-left: 5px;"></i>
				</el-tooltip>
			</div>
		</div>
	</header>
	<div class="sidebar-tree-box" @contextmenu.prevent="() => {return false}">
		<el-scrollbar style='height: 100%;'>
			<el-tree class="sidebar-tree" :data="state.nodes" node-key="id" highlight-current :default-expand-all="true" ref="listTree"
			         @current-change="onCurrentChange" :expand-on-click-node="false" :filter-node-method="filterNode">
				<template #default="{ node, data }">
					<div class="sidebar-tree-node" :title="data.source.info">
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
			color: rgb(189,189,189);
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
			
			.el-input__inner {
				height: 30px;
				line-height: 30px;
				border: none;
			}
		}
	}
}
</style>

<style scoped lang="scss">
header {
	padding: 10px 15px 0;height: 75px;border-bottom: 1px solid #6f6d6d1c;
}

.sidebar-tree-box {
	height: calc(100% - 75px);
	padding: 10px;
	
	.sidebar-tree {
		.sidebar-tree-node {
			line-height: 35px; height: 35px;
			.tag { display: inline-block; width: 8px;height: 8px; border-radius: 8px; margin-right: 5px; }
			i { line-height: 35px; height: 35px;font-size: 20px; padding-right: 8px; color: #8d8d8d; }
			span { line-height: 35px; height: 35px;font-size: 17px; padding-top: 2px; color: #333333; }
		}
		
		&:deep(.el-tree-node:focus) > .el-tree-node__content {
			--el-tree-node-hover-background-color:  transparent!important;
		}
	}
}
</style>