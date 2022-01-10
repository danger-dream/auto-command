export enum ServerState {
	not_connect = '未连接',
	success = '连接正常',
	timeout = '连接超时',
	connecting = '连接中...'
}

export declare interface IServer {
	id: string
	name: string
	host: string
	port: number
	user: string
	pwd: string
	state: string
	sys?: string
	arch?: string
	cpu?: string
	mem?: string
	disk?: string
}

export interface SystemInfo {
	ip: string
	platform: string
	arch: string
	procArch: string
	nodeVersion: string
	version: string
	hostname: string
	cpu: string
	mem: { total: number, used: number, ratio: number }
}

export interface RemoteSystemInfo {
	hostname: string
	uptime: string
	cpu: number
	activities: {
		cmd: string
		cpu: string
		mem: string
		pid: string
		user: string
		etime: string
	}[]
	mem: Record<string, {
		total: number
		used: number
		free: number
		ratio: string
	}>
	disks: {
		avail: string
		filesystem: string
		mount: string
		size: string
		used: string
		usedPercent: string
	}[]
	network: {
		dev: string
		ip: string
		download: number
		upload: number
		down_speed: number
		up_speed: number
	}[]
}

export interface TabInfo {
	label: string
	name: string
	component: any
	icon?: string
	svg?: string
	params: any
}

export enum TreeNodeType {
	public = 0,
	dir = 1,
	file = 2,
	task = 3
}

export interface TreeNode {
	id: string
	label: string
	path: string
	type: TreeNodeType
	source: any
	children?: any[]
	leaf?: boolean
	tid?: string
}