<script setup lang="ts">
import { reactive, ref, inject, defineProps, defineEmits, onMounted, onUnmounted } from 'vue'
import WebSocketClient from "../../lib/WebSocketClient";
import axios from "axios";
import * as Monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import {tip} from "../../Utils";

const props = defineProps<{ params: any }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { id, path, name, language } = props.params
const ws = inject('ws') as WebSocketClient
const containerRef = ref<any>(null)
const state = reactive({
	curLang: language,
	language: Monaco.languages.getLanguages()
})

let _subscription: Monaco.IDisposable | undefined
let editor = {} as Monaco.editor.IStandaloneCodeEditor

(window as any).MonacoEnvironment = {
	getWorker(_: any, label: any) {
		if (label === 'json')
		{ // noinspection JSPotentiallyInvalidConstructorUsage
			return new jsonWorker();
		}
		if (label === 'css' || label === 'scss' || label === 'less')
		{ // noinspection JSPotentiallyInvalidConstructorUsage
			return new cssWorker();
		}
		if (label === 'html' || label === 'handlebars' || label === 'razor')
		{ // noinspection JSPotentiallyInvalidConstructorUsage
			return new htmlWorker();
		}
		if (label === 'typescript' || label === 'javascript')
		{ // noinspection JSPotentiallyInvalidConstructorUsage
			return new tsWorker();
		}
		// noinspection JSPotentiallyInvalidConstructorUsage
		return new editorWorker();
	}
};

onMounted(async () => {
	const res = await axios.get('/resources/read?id=' + (id || '') + '&path=' + path)
	editor = Monaco.editor.create(containerRef.value, {
		value: res.data.text,
		language: language,
		formatOnPaste: true,
		wordWrap: "on", //自动换行，注意大小写
		wrappingIndent: "indent",
		tabSize: 4,
		minimap: {enabled: true}
	})
})

onUnmounted(() => {
	if (editor){
		try {
			editor.getModel()?.dispose()
		}catch {}
		editor.dispose()
	}
})

function onChangeLanguage(id: string){
	if (!editor) return
	Monaco.editor.setModelLanguage(editor.getModel() as any, id);
}

async function onSave(){
	const txt = editor.getValue()
	try {
		const res = await axios.post('/resources/write', { id: id || '', path, txt })
		if (res.data.success){
			tip.success('保存文件成功')
			return
		}
	}catch {}
	tip.error('保存文件失败')
}
</script>

<template>
	<div class="container">
		<header>
			<span>语言：</span>
			<el-select v-model="state.curLang" filterable placeholder="请选择语言" @change="onChangeLanguage">
				<el-option v-for="item in state.language" :key="item.id" :label="item.id" :value="item.id"/>
			</el-select>
			<el-button type="primary" style="margin-left: 10px;" @click="onSave">保存</el-button>
		</header>
		<div class="code" ref="containerRef"></div>
	</div>
</template>

<style scoped lang="scss">
	.container {
		width: 100%;
		height: 100%;
		border: 1px solid #eee;
		border-radius: 5px;
		
		header { line-height: 40px; overflow: hidden; width: 100%; background-color: #eee; padding: 5px 10px; }
		.code { height: calc(100% - 52px); width: 100%; }
	}
</style>