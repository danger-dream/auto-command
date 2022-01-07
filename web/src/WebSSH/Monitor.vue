<script lang="ts" setup>
import '../assets/stat.iconfont'
import {Refresh} from '@element-plus/icons-vue'
import { reactive, inject, computed } from 'vue'
import YLEventEmitter from "../lib/YLEventEmitter";
import {IServer, RemoteSystemInfo} from "../types";
import { formatSizeToStr, formatByteSizeToStr } from '../Utils'

const event = inject('event') as YLEventEmitter
const state = reactive({
	server: {} as IServer,
	systemInfo: {
		hostname: '-',
		uptime: '',
		cpu: 0,
		activities: [],
		mem: {},
		disks: [],
		network: []
	} as RemoteSystemInfo,
	
})

event.on('set-server', function (server: IServer){
	Object.assign(state.server, server)
}).on('server.system', function (data: any){
	Object.assign(state.systemInfo, data)
})

const mem = computed(() => {
	if (!state.systemInfo.mem || !state.systemInfo.mem['mem']) return { ratio: '-', total: 0, free: 0, used: 0 }
	return state.systemInfo.mem['mem']
})

const network = computed(() => {
	const res = { dev: '', ip: '', download: 0, upload: 0, down_speed: 0, up_speed: 0 }
	if (state.systemInfo.network.length < 1) return res
	const net = state.systemInfo.network.find(x => x.ip === state.server.host)
	if (!net) return res
	return net
})
</script>

<template>
	<div style="height: 100%; overflow-y: auto; padding: 20px; background-color: #f0f2f5;">
		<el-row :gutter="15" justify="center" style="margin-bottom: 15px">
			<el-col :span="4">
				<div class="card-panel">
					<div class="card-panel-icon-wrapper" style="color: #409EFF;">
						<el-icon :size="48" style="float: left;">
							<svg class="icon" aria-hidden="true">
								<use xlink:href="#icon-cpu"></use>
							</svg>
						</el-icon>
					</div>
					<div class="card-panel-description">
						<div class="card-panel-text"> CPU使用率 </div>
						<span class="card-panel-num"> {{ state.systemInfo.cpu }}% </span>
					</div>
				</div>
			</el-col>
			<el-col :span="7">
				<div class="card-panel">
					<div class="card-panel-icon-wrapper" style="color: #40c9c6;">
						<el-icon :size="48" style="float: left;">
							<svg class="icon" aria-hidden="true"><use xlink:href="#icon-mem"></use></svg>
						</el-icon>
					</div>
					<div class="card-panel-description">
						<div class="card-panel-text"> 内存使用率 </div>
						<span class="card-panel-num">{{ mem.ratio }}%</span>
					</div>
					<div class="card-panel-description">
						<div class="card-panel-text"> Use </div>
						<span class="card-panel-num"> {{ formatSizeToStr(mem.used * 1024) }} </span>
					</div>
					<div class="card-panel-description">
						<div class="card-panel-text"> Total </div>
						<span class="card-panel-num"> {{ formatSizeToStr(mem.total * 1024) }} </span>
					</div>
				</div>
			</el-col>
			<el-col :span="11">
				<div class="card-panel">
					<div class="card-panel-icon-wrapper" style="color: #67C23A;">
						<el-icon :size="48" style="float: left;">
							<svg class="icon" aria-hidden="true"><use xlink:href="#icon-network"></use></svg>
						</el-icon>
					</div>
					<div class="card-panel-description max">
						<div class="card-panel-text"> 上传速度 </div>
						<span class="card-panel-num">↑ {{ formatByteSizeToStr(network.down_speed) }}/s</span>
					</div>
					<div class="card-panel-description max">
						<div class="card-panel-text"> 下载速度 </div>
						<span class="card-panel-num">↓ {{ formatByteSizeToStr(network.up_speed) }}/s</span>
					</div>
					<div class="card-panel-description">
						<div class="card-panel-text"> 总上传 </div>
						<span class="card-panel-num">{{ formatByteSizeToStr(network.download) }}</span>
					</div>
					<div class="card-panel-description">
						<div class="card-panel-text"> 总下载 </div>
						<span class="card-panel-num">{{ formatByteSizeToStr(network.upload) }}</span>
					</div>
				</div>
			</el-col>
		</el-row>
		<el-row :gutter="15" justify="center" style="margin-bottom: 15px; height: calc(100% - 60px - 108px - 250px); min-height: 300px;">
			<el-col :span="22" style="height: 100%;">
				<div class="stat-block">
					<div class="header">
						<el-icon class="header-icon" :size="20">
							<svg class="icon" aria-hidden="true">
								<use xlink:href="#icon-process"></use>
							</svg>
						</el-icon>
						<div class="title">进程列表<span>({{ state.systemInfo.activities.length }})</span></div>
						<el-button :icon="Refresh" circle class="btn" @click="state.systemInfo.activities.splice(0, state.systemInfo.activities.length)"/>
					</div>
					<div class="view">
						<el-table :data="state.systemInfo.activities" size="small" border highlight-current-row height="100%">
							<el-table-column prop="pid" label="PID" sortable width="70" align="center"/>
							<el-table-column prop="user" label="用户" sortable width="70" align="center"/>
							<el-table-column prop="cpu" label="CPU" sortable width="70" align="center">
								<template #default="{ row }">{{ row.cpu }}%</template>
							</el-table-column>
							<el-table-column prop="mem" label="内存" sortable width="80" align="center">
								<template #default="{ row }">{{ formatByteSizeToStr(row.mem) }}</template>
							</el-table-column>
							<el-table-column prop="cmd" label="命令行" sortable show-overflow-tooltip/>
							<el-table-column prop="etime" label="运行时间" sortable width="120" align="center">
								<template #default="{ row }">{{ row.etime.replace('-', '天 ') }}</template>
							</el-table-column>
						</el-table>
					</div>
				</div>
			</el-col>
		</el-row>
		<el-row :gutter="15" justify="center" style="height: 250px;">
			<el-col :span="11" style="height: 100%">
				<div  class="stat-block">
					<div class="header">
						<el-icon class="header-icon" :size="20">
							<svg class="icon" aria-hidden="true">
								<use xlink:href="#icon-network"></use>
							</svg>
						</el-icon>
						<div class="title">网卡列表<span>({{ state.systemInfo.network.length }})</span></div>
						<el-button :icon="Refresh" circle class="btn" @click="state.systemInfo.network.splice(0, state.systemInfo.network.length)"/>
					</div>
					<div class="view">
						<el-table :data="state.systemInfo.network" size="small" border highlight-current-row height="100%">
							<el-table-column prop="dev" label="设备名称" sortable align="center" show-overflow-tooltip/>
							<el-table-column prop="ip" label="IP" sortable width="120" align="center" show-overflow-tooltip/>
							<el-table-column prop="download" label="总下载" sortable width="80" align="center">
								<template #default="{ row }">{{ formatByteSizeToStr(row.download) }}</template>
							</el-table-column>
							<el-table-column prop="upload" label="总上传" sortable width="80" align="center">
								<template #default="{ row }">{{ formatByteSizeToStr(row.upload) }}</template>
							</el-table-column>
							<el-table-column prop="down_speed" label="下载速度" sortable width="90" align="center">
								<template #default="{ row }">{{ formatByteSizeToStr(row.down_speed) }}</template>
							</el-table-column>
							<el-table-column prop="up_speed" label="上传速度" sortable width="90" align="center">
								<template #default="{ row }">{{ formatByteSizeToStr(row.up_speed) }}</template>
							</el-table-column>
						</el-table>
					</div>
				</div>
			</el-col>
			<el-col :span="11" style="height: 100%;">
				<div  class="stat-block">
					<div class="header">
						<el-icon class="header-icon" :size="20">
							<svg class="icon" aria-hidden="true">
								<use xlink:href="#icon-disk"></use>
							</svg>
						</el-icon>
						<div class="title">文件系统<span>({{ state.systemInfo.disks.length }})</span></div>
						<el-button :icon="Refresh" circle class="btn" @click="state.systemInfo.disks.splice(0, state.systemInfo.disks.length)"/>
					</div>
					<div class="view">
						<el-table :data="state.systemInfo.disks" size="small" border highlight-current-row height="100%">
							<el-table-column prop="filesystem" label="文件系统" sortable width="120" show-overflow-tooltip/>
							<el-table-column prop="size" label="容量" sortable width="70" align="center"></el-table-column>
							<el-table-column prop="used" label="已用" sortable width="70" align="center"></el-table-column>
							<el-table-column prop="avail" label="可用" sortable width="70" align="center"></el-table-column>
							<el-table-column prop="mount" label="挂载点" sortable align="center" show-overflow-tooltip></el-table-column>
						</el-table>
					</div>
				</div>
			</el-col>
		</el-row>
	</div>
</template>

<style scoped lang="scss">
.card-panel {
	height: 108px;
	cursor: pointer;
	font-size: 12px;
	position: relative;
	overflow: hidden;
	color: #666;
	background: #fff;
	box-shadow: 4px 4px 40px rgb(0 0 0 / 5%);
	border-color: rgba(0,0,0,.05);

	.card-panel-icon-wrapper {
		float: left;
		margin: 14px 0 0 14px;
		padding: 16px;
		-webkit-transition: all .38s ease-out;
		transition: all .38s ease-out;
		border-radius: 6px;
	}
	
	.card-panel-description{
		float: right;
		font-weight: 700;
		margin: 26px 26px 26px 0;
		
		.card-panel-text {
			line-height: 18px;
			color: rgba(0,0,0,.45);
			font-size: 16px;
			margin-bottom: 12px;
		}
		.card-panel-num {
			font-size: 20px;
		}
	}
	.max {
		min-width: 150px;
	}
}

.stat-block {
	height: 100%; background-color: #ffffff;

	.header {
		width: 100%; height: 40px;line-height: 40px;

		.header-icon { margin: 0 10px; height: 40px; float: left; }
		.title { float: left }
		.btn { float: right; margin: 4px 10px 0 0; }
	}
	
	.view { height: calc(100% - 40px); width: 100%; overflow: hidden }
}
</style>
