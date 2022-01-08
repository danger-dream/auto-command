const fs = require("fs");
const { basename, dirname, join } = require("path");
const ssh2 = require("./ssh2");
const EventEmitter = require('events').EventEmitter

function shell_escape_1(a) {
	let ret = [];
	a.forEach(function(s) {
		if (!/^[A-Za-z0-9_\/-]+$/.test(s)) {
			s = "'"+s.replace(/'/g,"'\\''")+"'";
			s = s.replace(/^(?:'')+/g, '') // unduplicate single-quote at the beginning
				.replace(/\\'''/g, "\\'" ); // remove non-escaped single-quote if there are enclosed between 2 escaped
		}
		ret.push(s);
	});
	return ret.join(' ');
}

class SSHError extends Error {
    constructor(message, code = null) {
        super(message);
        this.code = code;
    }
}
exports.SSHError = SSHError;
function unixifyPath(path) {
    if (path.includes('\\')) {
        return path.split('\\').join('/');
    }
    return path;
}

class NodeSSH extends EventEmitter {
	connection = undefined
	server = undefined
	sftp = undefined
	config = {}
	
    constructor(server, config = { privateKey: '' }) {
		super()
	    this.server = Object.assign({ port: 22, user: 'root' }, server)
	    this.config = config
	    if (config.privateKey) {
		    if (!((config.privateKey.includes('BEGIN') && config.privateKey.includes('KEY')) ||
			    config.privateKey.includes('PuTTY-User-Key-File-2'))) {
			    if (!fs.existsSync(config.privateKey)){
				    throw new Error('私钥文件不存在')
			    }
			    try {
				    config.privateKey = fs.readFileSync(config.privateKey, { encoding: 'utf8' });
			    } catch (err) {
				    throw new Error('读取私钥文件失败: ' + err.message);
			    }
		    }
	    }
    }
	
	static async createConnect(server, config = {}){
		const ssh = new NodeSSH(server, config)
		await ssh.connect()
		const connect = ssh.getConnection()
		connect.on('error', () => {}).on('close', () => { ssh.connection = null })
		await ssh.requestSFTP()
		return ssh
	}
	
    getConnection() {
        const { connection } = this;
        if (!connection) {
            throw new Error('Not connected to server');
        }
        return connection;
    }
	
    async connect() {
	    let self = this
	    if (this.connection) return this.connection
        if (!this.server.pwd && !this.config.privateKey) {
            throw new Error('密钥必须是有效的字符串')
        }
        const connection = this.connection = new ssh2.Client();
        await new Promise((resolve, reject) => {
			function error(e){
				if (e.level === 'client-authentication') return reject(new Error('账号密码错误'))
				if (e.level === 'client-timeout') return reject(new Error('连接超时'))
				if (e.code === 'ENETUNREACH') return reject(new Error('连接失败'))
				return reject(new Error('未知错误' + e.message))
			}
            connection.on('error', error);
            connection.on('ready', () => {
                connection.off('error', error);
                resolve();
            });
            connection.on('end', () => {
                if (this.connection === connection) {
                    this.connection = null;
                }
            });
            connection.on('close', () => {
                if (this.connection === connection) {
                    this.connection = null;
	                self.emit('close')
                }
                reject(new Error('服务器没有响应'));
            });
            connection.connect(Object.assign({}, {
	            host: this.server.host,
	            port: this.server.port,
	            username: this.server.user,
	            password: this.server.pwd
            }, this.config));
        });
        return this;
    }
	
    async requestSFTP() {
		if (this.sftp) return this.sftp
        const connection = this.getConnection();
		let self = this
        return new Promise((resolve, reject) => {
            connection.sftp((err, sftp) => {
                if (err) {
					self.sftp = undefined
					return reject(err);
                }
	            function onExit(){
		            self.sftp = undefined
		            self.requestSFTP().catch(() => {})
	            }
	            sftp.on('exit', onExit).on('close', onExit)
	            self.sftp = sftp;
	            resolve(sftp);
            });
        });
    }
	
	shell(){
		return new Promise((resolve, reject) => {
			const connection = this.getConnection();
			connection.shell((err, stream) => {
				if (err)
					return reject(new Error('open shell error:' + err.message));
				resolve(stream)
			});
		})
	}
	
    async execCommand(givenCommand, options = {}) {
        let command = givenCommand;
        if (options.cwd) {
            command = `cd ${shell_escape_1([options.cwd])} ; ${command}`;
        }
        const connection = this.getConnection();
        const output = [];
        return new Promise((resolve, reject) => {
            connection.exec(command, {}, (err, channel) => {
                if (err) {
                    reject(err);
                    return;
                }
                channel.on('data', (chunk) => output.push(chunk.toString()))
                channel.stderr.on('data', (chunk) => output.push(chunk.toString()))
	            channel.end()
                let code = null;
                let signal = null;
                channel.on('exit', (code_, signal_) => {
                    code = code_ !== null && code_ !== void 0 ? code_ : null;
                    signal = signal_ !== null && signal_ !== void 0 ? signal_ : null;
                });
                channel.on('close', () => {
                    resolve({
                        code: code != null ? code : null,
                        signal: signal != null ? signal : null,
                        stdout: output.join('').trim()
                    });
                });
            });
        });
    }
	
    async exec(command) {
        try {
	        if (!Array.isArray(command)){
		        command = [command]
	        }
	        return (await this.execCommand(command.join(' && '))).stdout;
        }catch {
			return ''
        }
    }
	
	readDir(path){
		return new Promise(async (resolve) => {
			try {
				const sftp = await this.requestSFTP()
				sftp.readdir(path, (err, list) => resolve(err ? [] : list))
			}catch {
				resolve([])
			}
		})
	}
	
    async mkdir(path, attrs) {
	    return new Promise(async (resolve) => {
		    try {
			    const sftp = await this.requestSFTP()
			    sftp.mkdir(path, attrs, e => resolve(!e))
		    }catch {
			    resolve(false)
		    }
	    })
    }

	stat(filename){
		return new Promise(async (resolve) => {
			try {
				const sftp = await this.requestSFTP()
				sftp.stat(filename, (err, result) => resolve(err ? undefined : result))
			}catch {
				resolve(undefined)
			}
		})
	}

    exists(filename){
        return new Promise(async (resolve) => {
            try {
	            const sftp = await this.requestSFTP()
	            sftp.exists(filename, res => resolve(res))
            }catch {
	            resolve(false)
            }
        })
    }
	
	removeFile(filename){
		return new Promise(async (resolve) => {
			try {
				const sftp = await this.requestSFTP()
				sftp.unlink(filename, e => resolve(!e))
			}catch {
				resolve(false)
			}
		})
	}
	
	
	donwloadFile(localFile, remoteFile, transferOptions = {}) {
		return new Promise(async (resolve) => {
			try {
				const sftp = await this.requestSFTP();
				sftp.fastGet(unixifyPath(remoteFile), localFile, transferOptions, (e) => resolve(!e));
			} catch {
				resolve(false);
			}
		});
	}
	
	readFile(filename){
		let self = this
		if (!filename || typeof filename !== 'string') return false
		return new Promise(async (resolve) => {
			try {
				const sftp = await self.requestSFTP()
				sftp.readFile(filename, (err, buf) => resolve(err ? undefined: buf))
			}catch {
				resolve(undefined)
			}
		})
	}
	
	async createReadStream(filename, opts = {}){
		const sftp = await this.requestSFTP()
		return sftp.createReadStream(filename, opts)
	}
	
	async appendFile(filename, buf) {
		let self = this
		if (!filename || typeof filename !== 'string') return false
		if (!Buffer.isBuffer(buf) && typeof buf !== 'string') return false
		return new Promise(async (resolve) => {
			try {
				const sftp = await self.requestSFTP()
				sftp.appendFile(filename, buf, (err) => resolve(!err))
			}catch {
				resolve(false)
			}
		})
	}
 
	async writeFile(filename, buf, flag = 'w'){
		let self = this
		if (!filename || typeof filename !== 'string') return false
		if (!Buffer.isBuffer(buf) && typeof buf !== 'string') return false
		return new Promise(async (resolve) => {
			try {
				const sftp = await self.requestSFTP()
				sftp.writeFile(filename, buf, { flag }, (err) => resolve(!err))
			}catch {
				resolve(false)
			}
		})
	}
	
	async putFile(localFile, remoteFile, transferOptions = {}){
		let self = this
		try {
			const sftp = await this.requestSFTP()
			const putFile1 = (retry) => {
				return new Promise(async (resolve) => {
					sftp.fastPut(localFile, unixifyPath(remoteFile), transferOptions || {}, async (err) => {
						if (err == null) {
							return resolve(true);
						}
						if (err.message === 'No such file' && retry) {
							await self.mkdir(dirname(remoteFile), 'sftp', sftp)
							await putFile1(false)
							resolve(true);
						}
						else {
							resolve(false);
						}
					});
				});
			};
			await putFile1(true);
			return true
		} catch {
			return false
		}
	}
	
	async createWriteStream(filename, opts = {}){
		const sftp = await this.requestSFTP()
		return sftp.createWriteStream(filename, opts)
	}
	
	uploadFileSteam(localPath, remotePath){
		return new Promise(async (resolve) => {
			try {
				const sftp = await this.requestSFTP()
				let result = true
				const rs = fs.createReadStream(localPath)
				const ws = await sftp.createWriteStream(remotePath)
				ws.on('error', function (){
					result = false
				});
				ws.once('close', () => resolve(result))
				rs.pipe(ws)
			}catch(e) {
				resolve(false)
			}
		})
	}
	
	async uploadDir(localPath, remotePath, override = false){
		try {
			if (!fs.existsSync(localPath)){
				return false
			}
			if (localPath.endsWith('/')){
				localPath = localPath.substring(0, localPath.length - 1)
			}
			if (remotePath.endsWith('/')){
				remotePath = remotePath.substring(0, localPath.length - 1)
			}
			const self = this
			let isRoot = true
			async function uploadDir(local, remote){
				try {
					const fileName = basename(local)
					const curRemotePath = isRoot ? remote : remote + '/' + fileName
					isRoot = false
					let isCreateDir = true
					if (await self.exists(curRemotePath)){
						if (override){
							await self.exec(`unalias mv && mv -r ${ remotePath } ${ remotePath }.bak`)
						}else {
							isCreateDir = false
						}
					}
					if (isCreateDir){
						//  创建远程目录
						await self.mkdir(curRemotePath)
					}
					for (const file of fs.readdirSync(local)){
						const curLocalPath = join(local, file)
						if (fs.statSync(curLocalPath).isDirectory()){
							await uploadDir(curLocalPath, curRemotePath)
						}else {
							const remoteFilePath = curRemotePath + '/' + file
							let isWriteFile = true
							if (await self.exists(remoteFilePath)){
								if (override){
									await self.exec(`unalias mv && mv -r ${ remotePath } ${ remotePath }.bak`)
								}else {
									isWriteFile = false
									continue
								}
							}
							if (isWriteFile){
								await self.uploadFileSteam(curLocalPath, remoteFilePath)
							}
						}
					}
					return true
				}catch {
					return false
				}
			}
			return await uploadDir(localPath, remotePath)
		}catch {
			return false
		}
	}
	
	close() {
        if (this.connection) {
            this.connection.end();
            this.connection = null;
        }
    }
}
module.exports = NodeSSH;
