const { join, parse, basename } = require('path')
const UploadHandle = require('../common/UploadHandle')
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
		app.post('/shell/upload', UploadHandle(async function (body, filename, stream, done){
			try {
				let { id, path } = body
				if (!path) return done(new Error('错误的参数'))
				const shell = getShell(id)
				const filepath = join(path, filename)
				const fileinfo = parse(filepath)
				if (!await shell.exists(fileinfo.dir)){
					const msg = await shell.exec(`mkdir -p ${ fileinfo.dir }`)
					if (msg){
						return done(new Error('创建目录失败:' + msg))
					}
				}
				const ws = await shell.createWriteStream(filepath)
				ws.on('error', (e) => done(e)).on('finish', () => done())
				stream.pipe(ws)
			}catch (e) {
				done(e)
			}
		}))
		
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
	readdir({ id, path }){
		return getShell(id).readDir(path)
	},
	mkdir({ id, name, path }){
		return getShell(id).exec(`cd ${ path }; mkdir ${ name }`)
	},
	move({ id, path, name }){
		return getShell(id).exec(`mv ${ path } ${ join(parse(path).dir, name) }`)
	},
	remove({ id, path }){
		return getShell(id).exec(`rm -rf ${ path }`)
	}
}