import type { ElForm } from 'element-plus'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
declare type MessageType = '' | 'success' | 'warning' | 'info' | 'error';

export function resetForm(formEl: InstanceType<typeof ElForm>){
	formEl.resetFields()
}

export function formValidate(formEl: InstanceType<typeof ElForm>): Promise<boolean>{
	return new Promise<boolean>(resolve => {
		formEl.validate((valid) => resolve(valid || false))
	})
}

export function date_format(dt: Date | number | undefined, fmt = 'yyyy-MM-dd hh:mm:ss') {
	if (!dt) {
		dt = new Date()
	}
	if (!(dt instanceof Date)) {
		dt = new Date(dt)
	}
	let o = {
		'M+': dt.getMonth() + 1,                 //月份
		'd+': dt.getDate(),                    //日
		'h+': dt.getHours(),                   //小时
		'm+': dt.getMinutes(),                 //分
		's+': dt.getSeconds(),                 //秒
		'q+': Math.floor((dt.getMonth() + 3) / 3), //季度
		'S': dt.getMilliseconds()             //毫秒
	} as Record<string, any>
	if (/(y+)/.test(fmt)) {
		fmt = fmt.replace(RegExp.$1, (dt.getFullYear() + "").substr(4 - RegExp.$1.length))
	}
	for (let k of Object.keys(o)) {
		if (new RegExp('(' + k + ')').test(fmt))
			fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (('00' + o[k]).substr(("" + o[k]).length)))
	}
	return fmt
}

export function S4(): string {
	return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
}

export function UUID(): string {
	return S4() + S4() + S4() + S4() + S4() + S4() + S4() + S4()
}


export function formatByteSizeToStr(size: number): string {
	if (!size){
		size = 0
	}
	if (size > 1000 * 1000 * 1000) {
		return (size / (1000 * 1000 * 1000)).toFixed(2) + ' GB'
	} else if (size > 1000 * 1000) {
		return (size / (1000 * 1000)).toFixed(2) + ' MB'
	} else if (size > 1000) {
		return (size / 1000).toFixed(2) + ' KB'
	} else {
		return size + ' B'
	}
}

export function formatSizeToStr(size: number): string {
	if (size > 1024 * 1024 * 1024) {
		return (size / (1024 * 1024 * 1024)).toFixed(2) + 'GB'
	} else if (size > 1024 * 1024) {
		return (size / (1024 * 1024)).toFixed(2) + 'MB'
	} else if (size > 1024) {
		return (size / 1024).toFixed(2) + 'KB'
	} else {
		return size + 'B'
	}
}

export function copy(text: string, showMsg = true): void {
	try {
		const input = document.createElement('textarea')
		document.body.appendChild(input)
		input.value = text
		input.select()
		let res = document.execCommand('copy')
		document.body.removeChild(input)
		if (res && (showMsg === undefined || showMsg)) {
			tip.success('已复制到剪切板')
		}
	} catch (e) {
	}
}

export function deepClone<T>(target: T): T {
	let result
	if (typeof target === 'object') {
		if (Array.isArray(target)) {
			result = []
			for (let item of target) {
				// 递归克隆数组中的每一项
				result.push(deepClone(item))
			}
			// 判断如果当前的值是null的话；直接赋值为null
		} else if (target === null) {
			result = null
			// 判断如果当前的值是一个RegExp对象的话，直接赋值
		} else {
			// 否则是普通对象，直接for in循环，递归赋值对象的所有值
			result = {} as any
			for (let k of Object.keys(target)) {
				result[k] = deepClone((target as any)[k])
			}
		}
		// 如果不是对象的话，就是基本数据类型，那么直接赋值
	} else {
		result = target
	}
	return result as T
}

export const tip = {
	info(msg: string){
		ElMessage.info(msg)
	},
	warn(msg: string){
		ElMessage.warning(msg)
	},
	error(msg: string){
		ElMessage.error(msg)
	},
	success(msg: string){
		ElMessage.success(msg)
	},
	async confirm(message: string, type: MessageType, btn: string = '确认', title: string = '确认'): Promise<boolean>{
		try {
			await ElMessageBox.confirm(message, title, {
				confirmButtonClass: btn,
				cancelButtonText: '取消',
				type
			})
			return true
		}catch {
			return false
		}
	},
	async prompt(msg: string, title: string, def?: string, cfg?: {}): Promise<string> {
		try {
			const { value } = await ElMessageBox.prompt(msg, title, Object.assign({
				confirmButtonText: '确定',
				cancelButtonText: '取消',
				closeOnClickModal: false,
				inputValue: def || ''
			}, cfg || {}))
			return value
		} catch {
			return ''
		}
	},
	notify: ElNotification
}

export function getQueryVariable(variable: string): string {
	const query = window.location.search.substring(1);
	const vars = query.split("&");
	for (const item of vars){
		const pair = item.split("=")
		if (pair[0] === variable)
			return pair[1]
	}
	return ''
}

export function getOSIcon(sys: string): string {
	if (!sys || sys === '-') return ''
	sys = sys.toLocaleLowerCase()
	for (const item of ['raspbian', 'redhat', 'suse', 'centos', 'ubuntu', 'debian', 'deepin']){
		if (sys.includes(item)){
			return '#icon-' + item
		}
	}
	return ''
}

export function calcTime(time: string): string {
	if (!time) return ''
	const start = new Date(time)
	const dt = Date.now() - start.getTime()
	const days = Math.floor(dt / (24 * 3600 * 1000))
	const leave1 = dt % (24 * 3600 * 1000)
	const hours = Math.floor(leave1 / (3600 * 1000))
	const leave2 = leave1 % (3600 * 1000)
	const minutes = Math.floor(leave2 / (60 * 1000))
	const seconds = Math.round((leave2 % (60 * 1000)) / 1000)
	return days + "天" + hours + "时" + minutes + "分" + seconds + "秒"
}