<script setup lang="ts">
import {onMounted, reactive, provide} from 'vue'
import {ElLoading} from "element-plus"
import WebSocketClient from "./lib/WebSocketClient";
import Server from './Server.vue'
//import Task from './Task/index.vue'
//import ScriptEdit from './ScriptEdit/index.vue'
//import Logger from './Logger.vue'
import {SystemInfo} from "./types";

const ws = new WebSocketClient('/api/base')
provide('ws', ws)

const state = reactive({
	activeIndex: 'server',
	systemInfo: {} as SystemInfo
})

onMounted(() => {
	let loadingInstance = ElLoading.service({
		fullscreen: true, body: true, lock: true,
		text: '正在连接服务器...'
	}) as any
	ws.onReady('main', function (){
		loadingInstance.close()
		loadingInstance = undefined
	}).onClose('main', function (){
		if (!loadingInstance){
			loadingInstance = ElLoading.service({ fullscreen: true, body: true, lock: true, text: '' }) as any
		}
		loadingInstance.setText('与服务器连接中断，正在重新连接...')
	}).on('systemInfo', function (res: SystemInfo){
		Object.assign(state.systemInfo, res)
	})
	ws.start()
})
</script>

<template>
	<div class="web-header">
		<div class="title">
			Auto Command
		</div>
		<el-menu :default-active="state.activeIndex" @select="index => state.activeIndex = index" mode="horizontal"
		    background-color="#545c64" text-color="#fff" active-text-color="#ffd04b"
		    style="position: absolute; left: 200px; width: 220px;">
			
			<el-menu-item index="server">服务器</el-menu-item>
<!--			<el-menu-item index="script">脚本编辑</el-menu-item>-->
<!--			<el-menu-item index="task">任务调度</el-menu-item>-->
<!--			<el-menu-item index="logger">日志</el-menu-item>-->
		</el-menu>
		<div class="right" v-if="state.systemInfo.ip">
			<el-row>
				<el-col :span="8">
					<em>局域网IP: </em>
					<span>{{ state.systemInfo.ip }}</span>
				</el-col>
				<el-col :span="16">
					<em>主机名: </em>
					<span :title="state.systemInfo.hostname">{{ state.systemInfo.hostname }}</span>
				</el-col>
				<el-col :span="8">
					<em>系统/架构: </em>
					<span>{{ state.systemInfo.platform }}/{{ state.systemInfo.arch }}</span>
				</el-col>
				<el-col :span="16">
					<em>系统版本: </em>
					<span :title="state.systemInfo.version">{{ state.systemInfo.version }}</span>
				</el-col>
				<el-col :span="8">
					<em>NodeJs: </em>
					<span>{{ state.systemInfo.nodeVersion }}/{{ state.systemInfo.procArch }}</span>
				</el-col>
				<el-col :span="8">
					<em>CPU: </em>
					<span>{{ state.systemInfo.cpu }}</span>
				</el-col>
				<el-col :span="8">
					<em>内存: </em>
					<span>{{ state.systemInfo.mem.ratio }}%</span>
				</el-col>
			</el-row>
		</div>
	</div>
	<div class="web-body">
		<server v-if="state.activeIndex === 'server'"></server>
<!--		<task v-else-if="state.activeIndex === 'task'"></task>-->
	</div>
</template>

<style lang="scss">
.el-menu--horizontal {border-bottom: none!important;}
</style>

<style lang="scss" scoped>
	.web-header {
		position: absolute; top: 0; height: 59px;left: 0; right: 0; background-color: #545c64;
		.title {
			position: absolute;left: 0;top: 0;width: 200px;height: 100%;
			line-height: 59px;text-align: center;color: #409EFF;font-size: 20px;
		}
		.right {
			position: absolute;right: 0;top: 1px;bottom: 0; color: #fefefea6; font-size: 7px; max-width: 520px;
			span, em { display: inline-block; line-height: 16px; height: 16px;overflow: hidden;text-overflow:ellipsis;white-space: nowrap; }
			em { width: 70px;  }
			span { width: calc(100% - 70px); }
		}
	}
	.web-body {
		position: absolute; top: 60px; left: 0; right: 0; bottom: 0; overflow: hidden;
	}
	.web-absolute {
		position: absolute; bottom: 20px; width: 100%; z-index: 4000;
		text-align: center;
	}
</style>
