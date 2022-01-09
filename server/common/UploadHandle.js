const Busboy = require("busboy");

module.exports = function (cb){
	return function (req, res, next) {
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
				try {
					let isCurDone = false
					function curDone(e){
						if (isCurDone) return
						isCurDone = true
						if (e){
							errors.push({ filename, error: e.message })
						}
						fileNumber--
						done()
					}
					
					fileStream.on('close', done).on('error', (e) => done(e))
					cb(body, filename, fileStream, curDone)
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
	}
}