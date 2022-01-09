const { statSync, existsSync, mkdirSync, createWriteStream, createReadStream, readdirSync, writeFileSync, readFileSync, renameSync } = require('fs')
const { join, parse, relative } = require('path')
const UploadHandle = require("../common/UploadHandle");
const {uuid, rmf} = require("../common/utils");
const TASKPREFIX = 'AC-TASK-'
const ResourcePath = join(__dirname, '../resources')

function formatPath(path){
	if (!path) return '.'
	if (path[0] === '/') return '.' + path
	return path
}

function taskId2Path(id){
	const taskName = TASKPREFIX + id
	const path = join(ResourcePath, taskName)
	if (!existsSync(path)) throw new Error('错误的任务编号')
	return path
}

function taskId2File(id){
	const taskName = TASKPREFIX + id
	const path = join(ResourcePath, taskName, taskName + '.json')
	if (!existsSync(path)) throw new Error('错误的任务编号')
	return path
}

/**
 * 资源
 * 一个任务一个文件夹直接存储在本地，任务存储与同名json文件
 * 任务文件夹添加特殊前缀让前端识别
 */

module.exports = {
	init(app){
		if (!existsSync(ResourcePath)){
			mkdirSync(ResourcePath, { recursive: true })
		}
		app.post('/resources/upload', UploadHandle(async function (body, filename, stream, done){
			try {
				// id = task id
				let { path, id } = body
				if (!path) return done(new Error('错误的参数'))
				path = formatPath(path)
				const filepath = id ? join(taskId2Path(id), path, filename) :join(ResourcePath, path, filename)
				const fileinfo = parse(filepath)
				if (!existsSync(fileinfo.dir)){
					mkdirSync(fileinfo.dir, { recursive: true })
				}
				const ws = createWriteStream(filepath)
				ws.on('error', (e) => done(e)).on('finish', () => done())
				stream.pipe(ws)
			}catch (e) {
				done(e)
			}
		}))
		app.get('/resources', function (req, res){
			let { id, path } = req.query
			if (!path) return res.end('错误的参数')
			path = formatPath(path)
			const filepath = id ? join(taskId2Path(id), path) :join(ResourcePath, path)
			createReadStream(filepath).pipe(res)
		})
	},
	/**
	 * 获取资源文件
	 * @param id 任务编号
	 * @param path 相对路径
	 */
	list({ id, path }){
		if (!path) throw new Error('错误的参数')
		path = formatPath(path)
		const curPath = id ? join(taskId2Path(id), path) :join(ResourcePath, path)
		if (!existsSync(curPath)) return []
		const rootPath = id ? join(ResourcePath, id) : ResourcePath
		return readdirSync(curPath).
			filter(x => !x.startsWith(TASKPREFIX)).
			map(x => {
				const c = join(curPath, x)
				const stat = statSync(c)
				return {
					name: x,
					path: '/' + relative(rootPath, c),
					dir: stat.isDirectory(),
					size: stat.size
				}
			})
	},
	/**
	 * 创建文件夹
	 * @param id 任务编号
	 * @param path 相对路径
	 * @param name 名称
	 * @returns {boolean}
	 */
	mkdir({ id, path, name }){
		const curPath = id ? join(taskId2Path(id), path, name) :join(ResourcePath, path, name)
		if (existsSync(curPath)) throw new Error('目录已存在')
		try {
			mkdirSync(curPath, { recursive: true })
			return true
		}catch {
			return false
		}
	},
	rename({ id, path, name }){
		const curPath = id ? join(taskId2Path(id), path) :join(ResourcePath, path)
		if (!existsSync(curPath)) throw new Error('路径不存在')
		const newPath = join(parse(path).dir, name)
		if (existsSync(newPath)) throw new Error('该名称的文件/目录已存在')
		try {
			renameSync(curPath, newPath)
			return true
		}catch {
			return false
		}
	},
	remove({ id, path }){
		const curPath = id ? join(taskId2Path(id), path) :join(ResourcePath, path)
		if (!existsSync(curPath)) throw new Error('路径不存在')
		try {
			rmf(curPath)
			return true
		}catch(e) {
			return false
		}
	},
	/**
	 * 加载所有任务
	 */
	loadTasks(){
		const result = []
		for (const item of readdirSync(ResourcePath).filter(x => x.startsWith(TASKPREFIX))){
			const path = join(ResourcePath, item, item + '.json')
			if (!existsSync(path)) continue
			result.push(JSON.parse(readFileSync(path).toString()))
		}
		return result
	},
	/**
	 * 创建任务
	 * @param name 任务名称
	 */
	createTask(name){
		const id = uuid()
		const taskName = TASKPREFIX + id
		const path = join(ResourcePath, taskName)
		mkdirSync(path, { recursive: true })
		writeFileSync(join(path, taskName + '.json'), JSON.stringify({ id, name }))
		return id
	},
	/**
	 * 加载任务
	 * @param id 任务编号
	 * @returns {any}
	 */
	loadTask(id){
		return JSON.parse(readFileSync(taskId2File(id)).toString())
	},
	/**
	 * 保存任务
	 * @param body
	 */
	saveTask(body){
		const task = module.exports.loadTask(body.id)
		writeFileSync(taskId2File(body.id), JSON.stringify(Object.assign(task, body)))
		return true
	}
}