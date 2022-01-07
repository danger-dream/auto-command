const multer = require('multer')
const fs = require('fs')
const { join, parse } = require('path')
const { getAction } = require('../registerController')
const createWebSSH = require("../common/createWebSSH");
const shell = require("../common/ssh-node.js");

const getServerById = getAction('server.getById')
const websshMap = {}

const uploadPath = join(process.cwd(), './temp')
if (!fs.existsSync(uploadPath)){
	fs.mkdirSync(uploadPath)
}

module.exports = {
	init(app){
		app.post('/api/upload/:id', multer({dest: uploadPath}).any(), async function (req, res) {
			//req.files[0].path
			//req.files[0].filename
			res.json({ success: true, url: '/upload/' + req.files[0].filename })
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