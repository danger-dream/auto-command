const http = require('http')
const {WebSocketServer} = require('ws')

function addTrailingSlash(string) {
	let suffixed = string;
	if (suffixed.charAt(suffixed.length - 1) !== '/') {
		suffixed = `${suffixed}/`;
	}
	return suffixed;
}

function websocketUrl(url){
	if (url.indexOf('?') !== -1) {
		const [baseUrl, query] = url.split('?');
		return `${addTrailingSlash(baseUrl)}.websocket?${query}`
	}
	return `${addTrailingSlash(url)}.websocket`
}

class ExpressWs {
	
	constructor(app, options = { wsOptions: {} }) {
		let server = this.server = http.createServer(app)
		app.listen = function serverListen(...args) {
			return server.listen(...args)
		}
		app.ws = function (route, ...middlewares){
			const wrappedMiddlewares = middlewares.map(middleware => {
				return function (req, res, next){
					if (req.ws !== null && req.ws !== undefined) {
						req.wsHandled = true
						try {
							middleware(req.ws, req, next)
						} catch (err) {
							next(err)
						}
					} else {
						next()
					}
				}
			});
			app.get(...[websocketUrl(route)].concat(wrappedMiddlewares))
			return this
		}
		
		const wsOptions = options.wsOptions || {}
		wsOptions.server = server
		const wsServer = new WebSocketServer(wsOptions)
		wsServer.on('connection', (socket, request) => {
			if ('upgradeReq' in socket) {
				request = socket.upgradeReq
			}
			request.ws = socket
			request.wsHandled = false
			request.url = websocketUrl(request.url)
			const dummyResponse = new http.ServerResponse(request);
			dummyResponse.writeHead = function writeHead(statusCode) {
				if (statusCode > 200) {
					dummyResponse._header = ''
					socket.close();
				}
			};
			
			app.handle(request, dummyResponse, () => {
				if (!request.wsHandled) {
					socket.close()
				}
			});
		});
	}
}
module.exports = function (app){
	new ExpressWs(app)
}