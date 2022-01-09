const { statSync, unlinkSync, rmdirSync, readdirSync } = require('fs')
const {join} = require('path')

exports.uuid = function uuid(){
	const S4 = () => (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
	return S4() + S4() + S4() + S4() + S4() + S4() + S4() + S4()
}

exports.sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.rmf = function rmf(path) {
	if (statSync(path).isFile()){
		unlinkSync(path)
	}else {
		for (const item of readdirSync(path)){
			rmf(join(path, item))
		}
		rmdirSync(path)
	}
}