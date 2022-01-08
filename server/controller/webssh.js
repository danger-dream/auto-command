const Busboy = require("busboy")
const fs = require('fs')
const { join, parse, basename } = require('path')
const { getAction, websocketClients } = require('../registerController')
const createWebSSH = require("../common/createWebSSH");
const shell = require("../common/ssh-node.js");

const getServerById = getAction('server.getById')
const websshMap = {}

const uploadPath = join(process.cwd(), './temp')
if (!fs.existsSync(uploadPath)){
	fs.mkdirSync(uploadPath)
}

/**
 * @param id
 * @returns {Error | import('../common/ssh-node').NodeSSH}
 */
function getClientById(id) {
	if (!id) return new Error('Params Error')
	const client = websocketClients.find(x => x.ssh && x.ssh[id])
	if (!client) return new Error('Not Find Server')
	return client.ssh[id]
}

module.exports = {
	init(app){
		app.post('/server/upload', async function (req, res, next) {
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
						const ssh = getClientById(id)
						const filepath = join(path, filename)
						const fileinfo = parse(filepath)
						if (!await ssh.exists(fileinfo.dir)){
							const msg = await ssh.exec(`mkdir -p ${ fileinfo.dir }`)
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
						const ws = await ssh.createWriteStream(filepath)
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
		
		app.get('/server/download', async function (req, res){
			let { id, path } = req.query
			const error = (msg) => res.end(`<script>alert('${ msg }'); window.close()</script>`)
			if (!id || !path) return error('Params Error')
			let ssh = undefined;
			try {
				ssh = getClientById(id)
			}catch (e) {
				return error(e.message)
			}
			try {
				path = decodeURI(path)
				res.set('Content-Disposition', `attachment; filename="${ basename(path) }"`);
				(await ssh.createReadStream(path)).pipe(res)
			}catch (e) {
				error('Get ReadStream Error：' + e.message)
			}
		})
	},
	requestWEBSSH(id, client){
		if (!id) throw new Error('未知的服务器')
		const server = getServerById(id)
		if (!server) throw new Error('错误的服务器编号')
		const webssh = createWebSSH(server, client, function (){
			delete websshMap[webssh.id]
		})
		websshMap[webssh.id] = webssh
		webssh.start()
	},
	async startWEBSSH(id, client){
		const webssh = websshMap[id]
		if (!webssh) throw new Error('错误的参数')
		if (!client.ssh){
			client.ssh = {}
		}
		if (!client.ssh[webssh.server.id]){
			const ssh = await shell.createConnect(webssh.server)
			client.onExit(function (){
				try {
					ssh.close()
				}catch {}
				delete client.ssh[webssh.server.id]
			})
			client.ssh[webssh.server.id] = ssh
		}
		webssh.setResClient(client)
	},
	sendWEBSSHMsg({id, action, data}){
		const webssh = websshMap[id]
		if (!webssh) throw new Error('错误的参数')
		webssh.send(action, data)
	},
	getByUUID(id){
		const webssh = websshMap[id]
		if (!webssh) throw new Error('错误的参数')
		const res = JSON.parse(JSON.stringify(webssh.server))
		delete res.pwd
		return res
	},
	async getUserGroups(id, client){
		if (!client.ssh){
			throw new Error('无法找到客户端关联信息')
		}
		try {
			const ssh = client.ssh[id]
			const userStr = await ssh.exec(`cat /etc/passwd`)
			const users = []
			for (const item of userStr.split('\n')){
				const arr = item.split(':')
				users.push({ id: Number(arr[2]), name: arr[4] })
			}
			const groupStr = await ssh.exec('cat /etc/group')
			const groups = []
			for (const item of groupStr.split('\n')){
				const arr = item.split(':')
				groups.push({ id: Number(arr[2]), name: arr[0] })
			}
			return { users, groups }
		}catch {}
		return []
	},
	async readdir({ id, path }, client){
		if (!client.ssh){
			throw new Error('无法找到客户端关联信息')
		}
		return await client.ssh[id].readDir(path)
	},
	async mkdir({ id, name, path }, client){
		if (!client.ssh){
			throw new Error('无法找到客户端关联信息')
		}
		await client.ssh[id].exec(`cd ${ path }; mkdir ${ name }`)
	},
	async move({ id, path, name }, client){
		if (!client.ssh){
			throw new Error('无法找到客户端关联信息')
		}
		await client.ssh[id].exec(`mv ${ path } ${ join(parse(path).dir, name) }`)
	},
	async remove({ id, path }, client){
		if (!client.ssh){
			throw new Error('无法找到客户端关联信息')
		}
		await client.ssh[id].exec(`rm -rf ${ path }`)
	}
}