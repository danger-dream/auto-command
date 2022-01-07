
export default class YLEventEmitter {
	
	private eventMap: Record<string, Array<Function>> = {}
	
	on(name: string, fn: Function): this {
		if (!this.eventMap[name]) {
			this.eventMap[name] = []
		}
		let index = this.eventMap[name].indexOf(fn)
		if (index >= 0) return this
		this.eventMap[name].push(fn)
		return this
	}
	
	off(name: string, fn: Function): this {
		if (!this.eventMap[name]) return this
		if (fn) {
			let index = this.eventMap[name].indexOf(fn)
			if (index >= 0) {
				this.eventMap[name].splice(index, 1)
			}
		} else {
			delete this.eventMap[name]
		}
		return this
	}
	
	emit(name: string, ...data: any): void {
		if (!this.eventMap[name]) return
		for (let fn of this.eventMap[name]) {
			try {
				fn(...data)
			} catch {
			
			}
		}
	}
}
