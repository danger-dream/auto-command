import YLEventEmitter from "./YLEventEmitter";

interface Result {
	index: any
	
	resolve(data: any): void
	
	reject(e: Error): void
}

export default class WebSocketClient extends YLEventEmitter {
	private readyFn: Record<string, Function> = {}
	private closeFn: Record<string, Function> = {}
	private callbackFn: Record<string, Result> = {}
	private ws: WebSocket = {} as any
	private isConnect: boolean = false
	
	constructor(private url: string) {
		super()
		let self = this
		setInterval(function (){
			self.sendSimple('__heartbeat')
		}, 10 * 1000)
	}
	
	public start(): Promise<void> {
		return new Promise((reslove) => {
			try {
				if (this.isConnect)
					return reslove()
				const self = this
				const baseUrl = window.location.origin.replace('http', 'ws')
				const ws = this.ws = new WebSocket(baseUrl + this.url)
				ws.onopen = function () {
					self.isConnect = true
					for (const k of Object.keys(self.readyFn)){
						try {
							self.readyFn[k]()
						}catch {}
					}
				}
				ws.onerror = () => { }
				ws.onclose = () => {
					self.isConnect = false
					self.clearCallback()
					for (const k of Object.keys(self.closeFn)){
						try {
							self.closeFn[k]()
						}catch {}
					}
					setTimeout(() => self.start().catch(() => {}), 2000)
				}
				ws.onmessage = this.onMessage.bind(this)
			}catch {
				reslove()
			}
		})
	}
	
	private clearCallback(){
		for (const k of Object.keys(this.callbackFn)){
			try {
				this.callbackFn[k].reject(new Error('与节点服务器连接断开'))
				delete this.callbackFn[k]
			}catch {}
		}
	}
	
	private onMessage(event: MessageEvent): void {
		try {
			const { sid, action, data, success, msg } = JSON.parse(event.data);
			if (!action) return;
			if (action === '__heartbeat'){
				//this.send('__heartbeat').then(() => {}).catch(() => {})
			}
			else if (action === '__result'){
				const result = this.callbackFn[sid];
				if (!result) return;
				if (success){
					result.resolve(data);
				}else {
					result.reject(new Error(msg))
				}
			}else {
				this.emit(action, data)
			}
		} catch {}
	}
	
	public send(action = '', params = undefined as any, timeout = 1000 * 30): Promise<any> {
		return new Promise((resolve, reject) => {
			if (!this.isConnect)
				return reject(new Error('当前未与节点服务建立连接'))
			
			let self = this
			const sid = Number(new Date().getTime() + parseInt((Math.random() * 10000) + '')).toString()
			const timeoutFn = () => {
				delete self.callbackFn[sid]
				reject(new Error('节点通信超时...'))
			}
			const clearCache = () => {
				clearTimeout(result.index)
				delete self.callbackFn[sid]
			}
			const result: Result = {
				index: setTimeout(timeoutFn, timeout),
				resolve(data: any): void {
					clearCache()
					resolve(data)
				},
				reject(e: Error): void {
					clearCache()
					reject(e)
				}
			};
			this.callbackFn[sid] = result
			try {
				this.ws.send(JSON.stringify({ sid, action, params }))
			} catch (e: any) {
				clearTimeout(result.index)
				reject(new Error('与节点通信失败：' + e.message))
			}
		});
	}
	
	public sendSimple(action = '', params = undefined as any): void {
		if (!this.isConnect)
			return
		try {
			this.ws.send(JSON.stringify({ action, params }))
		} catch{}
	}
	
	onReady(key: string, fn: Function){
		this.readyFn[key] = fn
		if (this.isConnect){
			try {
				fn()
			}catch {}
		}
		return this
	}
	
	onClose(key: string, fn: Function){
		this.closeFn[key] = fn
		if (!this.isConnect){
			try {
				fn()
			}catch {}
		}
		return this
	}
}