const Busboy = require("busboy")
const { join, parse, basename } = require('path')
const { invoke } = require('../RegisterController')
const CreateWebShell = require("../common/CreateWebShell");

const WebShellMap = {}

function getWebShell(id){
	const shell = WebShellMap[id]
	if (!shell){
		throw new Error('未找到服务')
	}
	return shell
}

function getShell(id){
	return getWebShell(id).shell
}

module.exports = {
	init(app){
		app.post('/shell/upload', async function (req, res, next) {
			if (!req.headers['content-type'].includes('multipart')) return next()
			try {
				let fileNumber = 0
				/**
				 * @type { any }
				 */
				const busboy = Busboy({headers: req.headers, preservePath: true})
				let isDone = false
				let errors = []
				function done() {
					if (fileNumber > 0) return;
					if (isDone) return
					isDone = true
					req.unpipe(busboy)
					req.on('readable', req.read.bind(req))
					busboy.removeAllListeners()
					if (errors.length){
						res.json({ success: false, msg: errors })
					}else {
						res.json({ success: true })
					}
				}
				
				const body = {}
				busboy.on('field', (key, value) => body[key] = value)
				busboy.on('file', async function (partName, fileStream, { filename }) {
					if (!filename) return fileStream.resume()
					fileNumber++
					let { id, path } = body
					try {
						if (!path) {
							// noinspection ExceptionCaughtLocallyJS
							throw new Error('错误的参数')
						}
						const shell = getShell(id)
						const filepath = join(path, filename)
						const fileinfo = parse(filepath)
						if (!await shell.exists(fileinfo.dir)){
							const msg = await shell.exec(`mkdir -p ${ fileinfo.dir }`)
							if (msg){
								// noinspection ExceptionCaughtLocallyJS
								throw new Error('创建目录失败:' + msg)
							}
						}
						let curDone = false
						const serCurDone = () => {
							if (curDone) return
							curDone = true
							fileNumber--
							done()
						}
						const ws = await shell.createWriteStream(filepath)
						ws.on('error', (e) => errors.push({ filename, error: e }))
						ws.on('finish', () => serCurDone)
						fileStream.on('close', serCurDone).on('error', (e) => errors.push({ filename, error: e.message }))
						fileStream.pipe(ws)
					}catch (e) {
						fileNumber--
						errors.push({ filename, error: e.message })
						return fileStream.resume()
					}
				})
				busboy.on('error', function (err) {
					errors.push({ filename: '', error: err.message })
					done()
				})
				busboy.on('finish', () => done())
				req.pipe(busboy)
			} catch (err) {
				return next(err)
			}
		})
		
		app.get('/shell/download', async function (req, res){
			let { id, path } = req.query
			const error = (msg) => res.end(`<script>alert('${ msg }'); window.close()</script>`)
			if (!id || !path) return error('Params Error')
			let shell = undefined;
			try {
				shell = getShell(id)
			}catch (e) {
				return error(e.message)
			}
			try {
				path = decodeURI(path)
				res.set('Content-Disposition', `attachment; filename="${ basename(path) }"`);
				(await shell.createReadStream(path)).pipe(res)
			}catch (e) {
				error('Get ReadStream Error：' + e.message)
			}
		})
	},
	async request(id, client){
		if (!id) throw new Error('未知的服务器')
		const server = invoke('server.getById', id)
		if (!server) throw new Error('错误的服务器编号')
		const shell = CreateWebShell(server, client, function (){
			delete WebShellMap[shell.id]
		})
		WebShellMap[shell.id] = await shell.start()
	},
	async start(id, client){
		getWebShell(id).setResClient(client)
	},
	send({id, action, data}){
		getWebShell(id).send(action, data)
	},
	getServerInfo(id){
		const res = JSON.parse(JSON.stringify(getWebShell(id).server))
		delete res.pwd
		return res
	},
	async getUserGroups(id){
		const shell = getShell(id)
		return { users: await shell.users(), groups: await shell.groups() }
	},
	async readdir({ id, path }){
		return await getShell(id).readDir(path)
	},
	async mkdir({ id, name, path }){
		await getShell(id).exec(`cd ${ path }; mkdir ${ name }`)
	},
	async move({ id, path, name }){
		await getShell(id).exec(`mv ${ path } ${ join(parse(path).dir, name) }`)
	},
	async remove({ id, path }){
		await getShell(id).exec(`rm -rf ${ path }`)
	}
}