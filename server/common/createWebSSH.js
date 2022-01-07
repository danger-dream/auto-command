const cluster = require('cluster')
if (!cluster.default){
	cluster.default = cluster
}

class CreateWebSSH {
	id = 'v' + (Date.now() + Number(new Date().getTime() + parseInt((Math.random() * 10000) + '')))
	exitFn = undefined
	server = undefined
	reqClient = undefined
	resClient = undefined
	worker = undefined
	
	constructor(server, reqClient, exitFn) {
		this.server = server
		this.reqClient = reqClient
		this.exitFn = exitFn
	}
	
	start(){
		if (!cluster.default.isPrimary){
			throw new Error('当前不在主进程中')
		}
		cluster.default.setupPrimary({
			exec: 'process/webssh.js', serialization: 'json',
			silent: false, windowsHide: true
		})
		const worker = this.worker = cluster.default.fork()
		worker.on('message', this.onMessage.bind(this))
		worker.on('exit', this.onExit.bind(this))
		worker.on('online', this.onLine.bind(this))
		worker.on('error', () => {})
		this.reqClient.send('webssh.createWEBSSH', { id: this.id })
		return this
	}
	
	send(action, data){
		try {
			this.worker.send({ action, data })
		}catch {}
		return this
	}
	
	setResClient(client){
		if (this.resClient){
			try {
				this.resClient.close()
			}catch {}
		}
		this.resClient = client
		let self = this
		client.onExit(function (res){
			if (res) return
			self.resClient = undefined
		})
		this.send('input', '\n')
		return this
	}
	
	close(){
		try {
			this.send('close')
		}catch {}
	}
	
	onLine(){
		this.send('connect', this.server)
	}
	
	onMessage(msg){
		const event = msg.event
		if (event === '__heartbeat') return
		if (event === 'connect'){
			this.reqClient.send(this.id, { event: 'ready' })
			return;
		}
		if (!this.resClient) return;
		try {
			this.resClient.send(this.id, msg)
		}catch {}
	}
	
	onExit(){
		if (this.resClient){
			this.resClient.send(this.id, { event: 'exit' })
		}
		if (this.exitFn){
			this.exitFn()
		}
	}
}
module.exports = function (server, reqClient, exitFn){
	return new CreateWebSSH(server, reqClient, exitFn)
}