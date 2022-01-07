const { readdirSync } = require('fs')
const {join} = require('path')

function uuid(){
	const S4 = () => (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
	return S4() + S4() + S4() + S4() + S4() + S4() + S4() + S4()
}

const controllerMap = {}
const clients = []

function push(action, data, type = ''){
	const list = type ? clients.filter(x => x.type === type) : clients
	list.forEach(x => x.send(action, data))
}

function createClient(ws, req){
	const uid = uuid()
	let userClose = false
	const client = {
		type: req.params.type || 'base',
		uid,
		ws,
		exitFn: [],
		push,
		send(action, data){
			try {
				ws.send(JSON.stringify({ action: action, data }))
			}catch { }
		},
		onExit(fn){
			client.exitFn.push(fn)
		},
		close(){
			try {
				userClose = true
				ws.close()
			}catch {}
		}
	}
	clients.push(client)
	ws.on('close', function (){
		try {
			for (const fn of client.exitFn){
				fn(userClose)
			}
		}catch {}
		clients.splice(clients.findIndex(x => x.uid === uid), 1)
	}).on('message', async function (msg){
		try {
			const obj = JSON.parse(msg + '')
			if (obj === undefined || Object.keys(obj).length < 1) return
			const fn = controllerMap[obj.action]
			if (!obj.action || !fn) return
			if (obj.action === '__heartbeat') return
			let res = { action: '__result', sid: obj.sid, data: '', success: false, msg: '' }
			try {
				const result = await fn(obj.params, client)
				res.success = true
				res.data = result
			}catch (e) {
				res.msg = e.message
			}
			if (!obj.sid) return
			ws.send(JSON.stringify(res))
		}catch {}
	})
}

exports.getAction = function (action){
	return controllerMap[action]
}

exports.register = async function (app) {
	app.ws('/api/:type', createClient)
	
	const rootPath = join(process.cwd(), './controller')
	for (const file of readdirSync(rootPath)){
		const module = require(join(rootPath, file))
		const filename = file.split('.')[0]
		for (const key of Object.keys(module)){
			if (key === 'init'){
				await module.init(app, push)
				continue
			}
			const keyName = `${ filename }.${ key }`
			controllerMap[keyName] = module[key]
			console.log(`注册方法: ${ keyName }`)
		}
	}
}