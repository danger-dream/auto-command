<script setup lang="ts">
import { reactive, provide, watch, nextTick } from 'vue'
import YLEventEmitter from "../lib/YLEventEmitter";
import TaskLeft from './left.vue'
import {TabInfo} from "../types";
const event = new YLEventEmitter()
provide('event', event)
const state = reactive({
	tabs: [] as TabInfo[],
	activeName: ''
})

const addTabView = (tab: TabInfo) => {
	if (state.tabs.find(x => x.name === tab.name)){
		state.activeName = tab.name
		return
	}
	state.tabs.push(tab)
	state.activeName = tab.name
}

event.on('set-tab-view', (tab: TabInfo) => addTabView(tab))
function onTabRemove(name: string) {
	const index = state.tabs.findIndex(x => x.name === name)
	if (index >= 0){
		state.tabs.splice(index, 1)
	}
	if (state.tabs.length < 1) {
		state.activeName = ''
		return
	}
	if (state.tabs.length - 1 >= index){
		state.activeName = state.tabs[index].name
	}else {
		state.activeName = state.tabs[index - 1].name
	}
}
watch(() => state.activeName, (v, old_value) => {
	if (v !== old_value){
		nextTick(() => event.emit('active-tab', v))
	}
})
</script>

<template>
	<div class="left">
		<task-left></task-left>
	</div>
	<div class="right">
		<el-tabs v-if='state.tabs.length > 0' class="right-tabs" v-model="state.activeName" type="card" closable @tab-remove='onTabRemove'>
			<el-tab-pane v-for='item in state.tabs' :label="item.label" :name="item.name">
				<template #label>
					<span><i :class="item.icon"></i> {{ item.label }}</span>
				</template>
				<component :is="item.componentName" :cid="item.name" :params='item.params' @close='onTabRemove(item.name)'></component>
			</el-tab-pane>
		</el-tabs>
		<div v-else class="info">
			自动化Shell设计器
		</div>
	</div>
</template>


<style scoped lang="scss">
.left { position: absolute;top: 0;bottom: 0;left: 0; width: 300px; }

.right {
	position: absolute;top: 0;bottom: 0;left: 300px; right: 0; z-index: 300;
	border-left: 1px solid #6f6d6d1c;
	.info {
		width: 100%;height: 100%; display: flex;flex-direction: column;
		justify-content: space-around;align-content: space-around;flex-wrap: wrap;
	}
}
</style>

<style lang="scss">
.right-tabs {
	width: 100%; height: 100%; padding-top: 10px;
	& > .el-tabs__header {
		--el-border-color-light: #DCDCDC;margin: 0;
		
		.el-tabs__nav-wrap > .el-tabs__nav-scroll > .el-tabs__nav {
			--el-border-color-light: #DCDCDC;
			border: none;
			.el-tabs__item {
				height: 33px; line-height: 33px;
				margin-left: 10px;
				border: 1px solid var(--el-border-color-light);
				border-bottom: none;
				
				&.is-active {
					border: 1px solid var(--el-border-color-light);
					border-bottom-color: #f6f6f6;
				}
			}
		}
	}
	& > .el-tabs__content {
		height: calc(100% - 35px); margin-top: 2px;
		.el-tab-pane { height: 100%; width: 100%; }
	}
}

</style>