const {existsSync} = require('fs')
const express = require('express')
const ExpressWs = require("./common/expressWs.js");
const { register } = require("./registerController.js");
const history = require('./common/history-api-fallback.js');

const port = 3010
const app = express();
new ExpressWs(app)
app.use(history())
app.use('/static', express.static('static'))
if (existsSync('./dist')){
	app.use(express.static('dist'))
} else {
	app.use(express.static('../web/dist'))
}

app.all('*', function (req, res, next) {
	res.header('Access-Control-Allow-Credentials', "true")
	res.header('Access-Control-Allow-Origin', '*')
	res.header("Access-Control-Allow-Headers", "*");
	res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS')
	next()
});

register(app).then(() => {
	app.listen(port, () => console.log('服务启动完成，http://localhost:' + port))
}).catch(e => {
	console.error('注册服务失败：' + e.message)
})