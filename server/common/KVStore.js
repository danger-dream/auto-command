const { existsSync, readFileSync, writeFileSync } = require('fs')
const { join } = require('path')
const alasql = require('alasql')

function deepClone(target) {
	let result
	if (typeof target === 'object') {
		if (Array.isArray(target)) {
			result = []
			for (let item of target) {
				result.push(deepClone(item))
			}
		} else if (target === null) {
			result = null
		} else {
			result = {}
			for (let k of Object.keys(target)) {
				result[k] = deepClone(target[k])
			}
		}
	} else {
		result = target
	}
	return result
}

class KVStore {
	
	constructor(path) {
		this.cache = []
		this.path = join(process.cwd(), './db', path)
		if (existsSync(this.path)){
			try {
				const res = JSON.parse(readFileSync(this.path).toString())
				if (Array.isArray(res)){
					this.cache.push(...res)
				}
			}catch {}
		}
	}
	
	sava_cache(){
		writeFileSync(this.path, JSON.stringify(this.cache, undefined, '\t'))
	}
	
	insert(data){
		data.id = Number(new Date().getTime() + parseInt((Math.random() * 10000) + ''))
		this.cache.push(data)
		this.sava_cache()
		return data.id
	}
	
	update(data, save = true){
		const res = this.cache.filter(x => x.id === data.id)
		if (res.length < 1) return 0
		for (const item of res){
			Object.assign(item, data)
		}
		save && this.sava_cache()
		return res.length
	}
	
	remove(id) {
		let index = this.cache.findIndex(x => x.id === id)
		if (index === -1) return false
		this.cache.splice(index, 1)
		this.sava_cache()
		return true
	}
	
	getById(id){
		let res = this.cache.find(x => x.id === id)
		return res ? deepClone(res) : undefined
	}
	
	list(page = 1, size = 20, sql, cols){
		let list = sql || cols ? this.query(sql, cols) : this.cache
		const st = (page - 1) * size
		const res = []
		for (let i = st; i < st + size; i++){
			if (!list[i])
				break
			res.push(list[i])
		}
		return deepClone({ total: list.length, data: res })
	}
	
	size(sql = ''){
		return this.query(sql).length
	}
	
	query(sql = '', cols = '') {
		if (!sql && !cols) return deepClone(this.cache)
		return deepClone(alasql(`select ${ cols || '*' } from ? ${ sql ? ' where ' + sql : '' }`, [this.cache]))
	}
}
module.exports = KVStore