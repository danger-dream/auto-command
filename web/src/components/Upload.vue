<script lang="ts">
import {ElLoading} from "element-plus";
import axios from "axios";
import {tip} from "../Utils";
import {ref, defineComponent} from "vue";

//  setup方式父组件无法获取当子组件属性...
export default defineComponent({
	setup(){
		const upload = ref<any>(null)
		const uploadDir = ref<any>(null)
		
		let curUrl = ''
		let curBody = {} as Record<string, any>
		let curCallback = (e?: Error) => {};
		const selectFile = (dir: boolean = false, url: string, body: Record<string, any>, cb: (e?: Error) => void) => {
			curUrl = url
			curBody = body
			curCallback = cb;
			(dir ? uploadDir : upload).value.click()
		}
		
		function onUploadFiles(e: any){
			const { target } = e
			if (!target || !target.files || target.files.length < 1) return
			const fd = new FormData()
			if (curBody){
				for (const k of Object.keys(curBody)){
					fd.append(k, curBody[k])
				}
			}
			for (const item of e.target.files){
				fd.append("attachment", item);
			}
			const loadingInstance = ElLoading.service({
				fullscreen: true, body: true, lock: true,
				text: '正在上传文件，请稍后...'
			}) as any
			axios.post(curUrl, fd).then((res) => {
				loadingInstance.close()
				if (res.data?.success){
					curCallback && curCallback()
					tip.success('上传文件成功')
				}else if (res.data?.msg){
					curCallback && curCallback(new Error(JSON.stringify(res.data.msg)))
					tip.error('上传文件时发生错误:' + JSON.stringify(res.data.msg))
				}else {
					curCallback && curCallback(new Error('未知错误'))
					tip.error('上传文件时发生未知错误')
				}
			}).catch(e => {
				loadingInstance.close()
				curCallback && curCallback(e)
				tip.error('上传文件时发生错误:' + e.message)
			})
		}
		return {
			upload,
			uploadDir,
			onUploadFiles,
			selectFile
		}
	}
})


</script>

<template>
	<input ref="upload" type="file" multiple @change="onUploadFiles" style="display: none;"/>
	<input ref="uploadDir" type="file" webkitdirectory multiple @change="onUploadFiles" style="display: none;"/>
</template>

<style scoped>

</style>