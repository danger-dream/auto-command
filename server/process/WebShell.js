const utf8 = require('../common/Utf8')
const NodeSSH = require('../common/NodeSSH')
const { sleep } = require('../common/utils')

let server = undefined
let shell = undefined
let stream = undefined
let isClose = false

//  关闭shell连接
async function closeShell(){
	try {
		stream && stream.close()
	}catch {}
	try {
		shell && await shell.close()
	}catch { }
}

async function createShell(){
	await closeShell()
	try {
		shell = await NodeSSH.createConnect(server)
		stream = await shell.shell()
		stream.on('data', function (buf){
			process.send({ event: 'data', data: utf8(buf.toString('binary')) })
		}).
		on('error', () => {}).
		on('close', () => {
			if (isClose) return
			stream = undefined
			createShell()
		})
	}catch (e) {
		process.send({ event: 'error', data: e.message })
	}
}

process.on('message', async function ({ action, data }){
	if (action === 'connect'){
		server = data
		createShell().then(() => {
			process.send({ event: 'connect' })
		}).catch(() => {
			process.send({ event: 'exit' })
			process.exit()
		})
		return
	}
	if (!shell || !stream) return
	if (action === 'input'){
		stream.write(data)
	}else if (action === 'resize'){
		try {
			stream.setWindow(data.rows, data.cols, 0, 0)
		}catch {}
	} else if (action === 'close'){
		isClose = true
		await closeShell()
		process.send({ event: 'exit' })
		process.exit()
	}
})

//  发送系统信息
function sendSystemInfo(type, data){
	process.send({ event: 'system.' + type, data })
}

//  处理hostname、disk
setInterval(async function (){
	try {
		process.send({ event: '__heartbeat' })
		const result = {}
		result.hostname = await shell.exec('hostname')
		result.disks = formatDisks(await shell.exec('df -h'))
		sendSystemInfo('base', result)
	}catch {}
}, 10 * 1000)

//  处理启动时间、进程
setTimeout(async function handleTimeAndProcess(){
	try {
		const result = {}
		result.uptime = await shell.exec('uptime -s')
		result.activities = formatActivities(await shell.exec('ps -h -axo pid,user,%cpu,size,etime,command | sort -b -k3 -r'))
		sendSystemInfo('process', result)
	}catch {}
	setTimeout(handleTimeAndProcess, 1000)
}, 1000)

//  处理cpu
setTimeout(async function handleCpu(){
	async function _getCPUInfo() {
		const cpus = await shell.exec(`grep 'cpu ' /proc/stat`)
		const arr = cpus.split(' ')
		arr.splice(0, 2)
		const result = { total: 0, idle: 0 }
		for (let i = 0; i < arr.length; i++){
			if (i === 3){
				result.idle += Number(arr[i])
			}
			result.total += Number(arr[i])
		}
		return result
	}
	let success = false
	try {
		const t1 = await _getCPUInfo()
		await sleep(1000)
		const t2 = await _getCPUInfo()
		sendSystemInfo('cpu', {
			cpu: ((1 - (t2.idle - t1.idle) / (t2.total - t1.total)) * 100.0).toFixed(2),
			mem: formatMem(await shell.exec('free'))
		})
		success = true
	}catch {}
	setTimeout(handleCpu, success ? 1 : 1000)
}, 1000)

//  处理网络
setTimeout(async function handleNetwork(){
	try {
		const t1 = formatNet(await shell.exec('ip -s link'), await shell.exec('ip addr'))
		await sleep(1000)
		const t2 = formatNet(await shell.exec('ip -s link'), await shell.exec('ip addr'))
		for (const now of t2){
			const old = t1.find(x => x.dev === now.dev)
			if (!old || !now.download || !old.download){
				now.down_speed = 0
				now.up_speed = 0
				continue
			}
			now.down_speed = now.download - old.download
			now.up_speed = now.upload - old.upload
		}
		sendSystemInfo('net', { network: t2 })
	}catch {}
	setTimeout(handleNetwork, 1000)
}, 1000)

function formatActivities(str){
	if (!str) return []
	return str.split('\n').filter(s => s).map(st => {
		const arr = st.split(/ +/)
		return { pid: arr[0], user: arr[1], cpu: arr[2], mem: arr[3], etime: arr[4], cmd: arr.slice(5).join(' ')}
	}).filter(d => d.pid)
}

function formatDisks (str) {
	if (!str) return []
	return str.split('\n').slice(1).map(s => {
		const arr = s.split(/ +/)
		return { filesystem: arr[0], size: arr[1], used: arr[2], avail: arr[3], usedPercent: arr[4], mount: arr[5] }
	}).filter(d => d.filesystem)
}

function formatMem(str) {
	if (!str) return {}
	return str.split('\n').filter(d => d).slice(1).reduce((p, d) => {
		const arr = d.split(/\s+/)
		if (!arr[1]) {
			return p
		}
		const res = { total: Number(arr[1]), used: Number(arr[2]), free: Number(arr[3]) }
		res.ratio = (res.used / res.total * 100).toFixed(2)
		p[arr[0].replace(':', '').toLowerCase()] = res
		return p
	}, {})
}

const ipSplitReg = /\n[\d]{1,5}:\s+/
function formatIps (ips) {
	if (!ips) {}
	return ips.split(ipSplitReg).reduce((p, s) => {
		const name = s.replace(/^[\d]{1,5}:\s+/, '').split(/:\s+/)[0]
		const arr1 = s.match(/inet\s+([\d]{1,3}\.[\d]{1,3}\.[\d]{1,3}\.[\d]{1,3})\/\d/)
		return { ...p, [name]: {ip: arr1 ? arr1[1] : ''}}
	}, {})
}

function formatTraffic (traffic, ipObj) {
	if (!traffic) return ipObj
	const arr = traffic.split(ipSplitReg)
	return arr.reduce((p, s) => {
		const name = s.replace(/^[\d]{1,5}:\s+/, '').split(/:\s+/)[0]
		const arr1 = s.split('\n')
		let download = 0
		let upload = 0
		const len = arr1.length
		for (let i = 0; i < len; i++) {
			const line = arr1[i]
			if (line.toLowerCase().trim().startsWith('rx')) {
				download = Number(arr1[i + 1].trim().split(/\s+/)[0])
			} else if (line.trim().toLowerCase().startsWith('tx')) {
				upload = Number(arr1[i + 1].trim().split(/\s+/)[0])
			}
		}
		if (!p[name]) {
			p[name] = {}
		}
		Object.assign(p[name], { download, upload })
		return p
	}, ipObj)
}

function formatNet (traffic, ips) {
	const res = formatTraffic(traffic, formatIps(ips))
	const result = []
	for (const key of Object.keys(res)){
		result.push(Object.assign({ dev: key }, res[key]))
	}
	return result
}

