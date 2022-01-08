const KVStore = require('../common/KVStore.js')
const NodeSSH = require('../common/NodeSSH.js')
const store = new KVStore('server.json')

async function getServerSystemInfo(item, cb){
	const nodeSSH = new NodeSSH(item)
	try {
		try {
			await nodeSSH.connect()
			item.state = '连接正常'
		}catch (e) {
			item.state = e.message
			return cb()
		}
		item.sys = (await nodeSSH.exec(`cat /etc/os-release | grep 'PRETTY_NAME=' | cut -f2 -d=`)).replaceAll('"', '').trim()
		item.arch = (await nodeSSH.exec(`uname -m;`)).trim()
		item.mode = await nodeSSH.exec('getconf LONG_BIT')
		item.cpu = (await nodeSSH.exec(`cat /proc/cpuinfo |grep 'processor'|wc -l`)).trim() + '核'
		try {
			item.mem = (await nodeSSH.exec(`cat /proc/meminfo | grep MemTotal | cut -f2 -d:`)).replace('kB', '')
			item.mem = (Number(item.mem.trim()) / 1024/1024).toFixed(2) + 'GB'
		}catch {}
		
		try {
			let disk = (await nodeSSH.exec('lsblk | grep disk')).replaceAll('\r', '').split('\n')
			let diskNum = 0
			for (const item of disk){
				diskNum += Number((item).trim().split(' ').filter(x => !!x)[3].replace('G', ''))
			}
			item.disk = diskNum + 'GB'
		}catch {}
	}
	catch {}
	finally {
		try {
			await nodeSSH.close()
		}catch {}
	}
	cb()
}
const OUTPWD = '--!$demo%^pwd*&--'
let loadingInfo = false
module.exports = {
	getById(id){
		return store.getById(id)
	},
	query(body = { sql: '', cols: '' }){
		return store.query(body.sql, body.cols).map(x => {
			x.pwd = OUTPWD
			return x
		})
	},
	insert(body){
		return store.insert(body)
	},
	update(body){
		if (body.pwd === OUTPWD){
			delete body.pwd
		}
		return store.update(body)
	},
	remove(id){
		return store.remove(id)
	},
	refresh(id, client){
		if (loadingInfo) return
		loadingInfo = true
		const list = id ? [store.getById(id)] : store.list(1, 9999)
		let n = 0
		for (const item of list){
			item.state = '连接中...'
			client.push('server.refresh', { id: item.id, state: item.state })
			store.update(item, false)
			getServerSystemInfo(item, function (){
				n++
				const tmp = JSON.parse(JSON.stringify(item))
				tmp.pwd = OUTPWD
				client.push('server.refresh', tmp)
				store.update(item)
				if (n === list.length){
					loadingInfo = false
				}
			}).catch(() => {})
		}
	}
}