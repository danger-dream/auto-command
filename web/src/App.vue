<script setup lang="ts">
import {onMounted, reactive, provide} from 'vue'
import {ElLoading} from "element-plus"
import WebSocketClient from "./lib/WebSocketClient";
import IconFont from './IconFont.vue'
import Server from './Server.vue'
import {SystemInfo} from "./types";
import Task from './Task/index.vue'

const ws = new WebSocketClient('/api/base')
provide('ws', ws)
const state = reactive({ activeIndex: 'server', info: {} as SystemInfo })

onMounted(() => {
	let loadingInstance = ElLoading.service({ fullscreen: true, body: true, lock: true, text: '正在连接服务器...' }) as any
	ws.onReady('main', function (){
		loadingInstance.close()
		loadingInstance = undefined
		
	}).onClose('main', function (){
		if (!loadingInstance){
			loadingInstance = ElLoading.service({ fullscreen: true, body: true, lock: true, text: '' }) as any
		}
		loadingInstance.setText('与服务器连接中断，正在重新连接...')
		
	}).on('system', (res: any) => Object.assign(state.info, res))
	ws.start()
})
</script>

<template>
	<icon-font></icon-font>
	<div class="header">
		<div class="title"> Auto Command </div>
		<el-menu :default-active="state.activeIndex" @select="index => state.activeIndex = index"
		    mode="horizontal" background-color="#545c64" text-color="#fff" active-text-color="#ffd04b"
		    style="position: absolute; left: 200px; width: 220px;">
			
			<el-menu-item index="server">服务器</el-menu-item>
			<el-menu-item index="task">任务</el-menu-item>
		</el-menu>
		<div class="right" v-if="state.info.ip">
			<el-row>
				<el-col :span="8">
					<em>局域网IP: </em>
					<span>{{ state.info.ip }}</span>
				</el-col>
				<el-col :span="16">
					<em>主机名: </em>
					<span :title="state.info.hostname">{{ state.info.hostname }}</span>
				</el-col>
				<el-col :span="8">
					<em>系统/架构: </em>
					<span>{{ state.info.platform }}/{{ state.info.arch }}</span>
				</el-col>
				<el-col :span="16">
					<em>系统版本: </em>
					<span :title="state.info.version">{{ state.info.version }}</span>
				</el-col>
				<el-col :span="8">
					<em>NodeJs: </em>
					<span>{{ state.info.nodeVersion }}/{{ state.info.procArch }}</span>
				</el-col>
				<el-col :span="8">
					<em>CPU: </em>
					<span>{{ state.info.cpu }}</span>
				</el-col>
				<el-col :span="8">
					<em>内存: </em>
					<span>{{ state.info.mem.ratio }}%</span>
				</el-col>
			</el-row>
		</div>
	</div>
	<div class="content">
		<server v-if="state.activeIndex === 'server'"></server>
		<task v-else-if="state.activeIndex === 'task'"></task>
	</div>
</template>

<style lang="scss">
.el-menu--horizontal {border-bottom: none!important;}
</style>

<style lang="scss" scoped>
	.header {
		position: absolute; top: 0; height: 59px;left: 0; right: 0; background-color: #545c64;
		.title {
			position: absolute;left: 0;top: 0;width: 200px;height: 100%;
			line-height: 59px;text-align: center;color: #409EFF;font-size: 20px;
		}
		.right {
			position: absolute;right: 0;top: 1px;bottom: 0; color: #fefefea6; font-size: 12px; max-width: 520px; cursor: default;
			span, em { display: inline-block; line-height: 16px; height: 16px;overflow: hidden;text-overflow:ellipsis;white-space: nowrap; }
			em { width: 70px;  }
			span { width: calc(100% - 70px); }
		}
	}
	.content {
		position: absolute; top: 60px; left: 0; right: 0; bottom: 0; overflow: hidden;
	}
</style>
