<template>
	<el-image v-if="isShow" ref="img" :src="url" :preview-src-list="srcList" @load="onLoad" @error="onError"
	          :hide-on-click-modal="true" @close="onClose" :append-to-body="true"
	          style="width: 100px; height: 100px; display: none;" :initial-index="1"></el-image>
</template>

<script lang="ts">
import {defineComponent, ref, reactive, toRefs, nextTick} from "vue";
import { tip } from "../../Utils";

export default defineComponent({
	setup(){
		const img = ref<any>(null)
		const state = reactive({
			url: '', srcList: [] as string[],
			isShow: false
		})
		return {
			...toRefs(state), img,
			async show(url: string){
				state.url = url
				state.srcList = [url]
				state.isShow = true
			},
			async onLoad(){
				try {
					await nextTick()
					img.value.$el.click()
					img.value.$el.firstChild.click()
				}catch {
					state.isShow = false
					state.url = ''
					state.srcList = []
					tip.error('显示图片时发生错误')
				}
			},
			onError(){
				tip.error('加载图片错误')
			},
			onClose(){
				state.isShow = false
			}
		}
	}
})


</script>

<style scoped>

</style>