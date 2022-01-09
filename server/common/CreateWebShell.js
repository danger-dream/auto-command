const cluster = require('cluster')
const NodeSSH = require("../common/NodeSSH.js");
if (!cluster.default) {
	cluster.default = cluster
}

class CreateWebShell {
	id = 'v' + (Date.now() + Number(new Date().getTime() + parseInt((Math.random() * 10000) + '')))
	exitFn = undefined
	server = undefined
	reqClient = undefined
	resClient = undefined
	worker = undefined
	shell = undefined
	
	closeTimeout = undefined
	
	constructor(server, reqClient, exitFn) {
		this.server = server
		this.reqClient = reqClient
		this.exitFn = exitFn
	}
	
	async start() {
		if (!cluster.default.isPrimary) {
			throw new Error('当前不在主进程中')
		}
		this.shell = await NodeSSH.createConnect(this.server)
		cluster.default.setupPrimary({
			exec: 'process/WebShell.js', serialization: 'json',
			silent: false, windowsHide: true
		})
		const worker = this.worker = cluster.default.fork()
		worker.on('message', this.onMessage.bind(this))
		worker.on('exit', this.onExit.bind(this))
		worker.on('online', this.onLine.bind(this))
		worker.on('error', () => {})
		this.reqClient.send('shell.create', {id: this.id})
		return this
	}
	
	send(action, data) {
		try {
			this.worker.send({action, data})
		} catch {
		}
		return this
	}
	
	setResClient(client) {
		clearTimeout(this.closeTimeout)
		if (this.resClient) {
			try {
				this.resClient.close()
			} catch {
			}
		}
		this.resClient = client
		let self = this
		client.onExit(function () {
			self.resClient = undefined
			self.closeTimeout = setTimeout(function () {
				self.close()
			}, 10 * 1000)
		})
		this.send('input', '\n')
		return this
	}
	
	close() {
		try {
			this.send('close')
		} catch {
		}
		try {
			this.shell && this.shell.close()
		} catch {
		}
		this.shell = undefined
		setTimeout(() => {
			try {
				if (this.worker) {
					this.worker.kill()
				}
				this.worker = undefined
			} catch {
			}
		}, 1000 * 3)
	}
	
	onLine() {
		this.send('connect', this.server)
	}
	
	onMessage(msg) {
		const event = msg.event
		if (event === '__heartbeat') return
		if (event === 'connect') {
			this.reqClient.send(this.id, {event: 'ready'})
			return;
		}
		if (!this.resClient) return;
		try {
			this.resClient.send(this.id, msg)
		} catch {
		}
	}
	
	onExit() {
		this.worker = undefined
		if (this.resClient) {
			this.resClient.send(this.id, {event: 'exit'})
		}
		if (this.exitFn) {
			this.exitFn()
		}
	}
}

module.exports = function (server, reqClient, exitFn) {
	return new CreateWebShell(server, reqClient, exitFn)
}