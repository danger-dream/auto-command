const os = require("os");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function getLocalIp(){
	const interfaces = os.networkInterfaces();
	for (let devName in interfaces) {
		let iface = interfaces[devName];
		for (const item of iface){
			if (item.family === 'IPv4' && item.address !== '127.0.0.1' && !item.internal) {
				return item.address;
			}
		}
	}
	return '';
}

async function getCPUUsage(){
	function _getCPUInfo() {
		const cpus = os.cpus();
		let user = 0, nice = 0, sys = 0, idle = 0, irq = 0, total = 0;
		for (let cpu in cpus) {
			const times = cpus[cpu].times;
			user += times.user;
			nice += times.nice;
			sys += times.sys;
			idle += times.idle;
			irq += times.irq;
		}
		total += user + nice + sys + idle + irq;
		return {user, sys, idle, total}
	}
	const t1 = _getCPUInfo()
	await sleep(1000)
	const t2 = _getCPUInfo(); // t2 时间点 CPU 信息
	const idle = t2.idle - t1.idle;
	const total = t2.total - t1.total;
	return ((1 - idle / total) * 100.0).toFixed(2) + "%";
}

function calcMem(){
	let mem_total = os.totalmem();
	mem_total = (mem_total / (1024 * 1024 * 1024)).toFixed(2);
	const mem_used = (mem_total - os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
	const mem_ratio = (mem_used / mem_total * 100).toFixed(2);
	return {
		total: mem_total,
		used: mem_used,
		ratio: mem_ratio
	}
}

function getSystemInfo(push){
	getCPUUsage().then(cpu => {
		try {
			const res = {
				ip: getLocalIp(),
				platform: os.platform(),
				arch: os.arch(),
				procArch: process.arch,
				nodeVersion: process.versions.node,
				version: os.version(),
				hostname: os.hostname(),
				cpu,
				mem: calcMem()
			}
			push('systemInfo', res, 'base')
		}catch {}
		getSystemInfo(push)
	}).catch(() => {
		getSystemInfo(push)
	})
}

module.exports = {
	init(_, push){
		getSystemInfo(push)
	}
}