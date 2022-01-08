const url = require('url')

module.exports = function historyApiFallback(options) {
	options = options || {};
	return function(req, res, next) {
		const headers = req.headers;
		if (req.method !== 'GET') {
			return next();
		} else if (!options.rewrites || options.rewrites.length < 1){
			return next();
		} else if (!headers || typeof headers.accept !== 'string') {
			return next();
		} else if (headers.accept.includes('application/json')) {
			return next();
		} else if (!acceptsHtml(headers.accept, options)) {
			return next();
		}
		const parsedUrl = url.parse(req.url);
		let rewriteTarget;
		options.rewrites = options.rewrites || [];
		for (const rewrite of options.rewrites){
			let match = parsedUrl.pathname.match(rewrite.from);
			if (!match) continue
			req.url = rewrite.to({ parsedUrl: parsedUrl, match: match, request: req })
			return next();
		}
		const pathname = parsedUrl.pathname;
		if (pathname.lastIndexOf('.') > pathname.lastIndexOf('/') && options.disableDotRule !== true) {
			return next();
		}
		rewriteTarget = options.index || '/index.html';
		req.url = rewriteTarget;
		next();
	};
};

function acceptsHtml(header, options) {
	options.htmlAcceptHeaders = options.htmlAcceptHeaders || ['text/html', '*/*'];
	for (let i = 0; i < options.htmlAcceptHeaders.length; i++) {
		if (header.indexOf(options.htmlAcceptHeaders[i]) !== -1) {
			return true;
		}
	}
	return false;
}