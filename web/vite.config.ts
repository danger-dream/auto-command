import { resolve } from 'path'
import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
// @ts-ignore
import MonacoEditorNlsPlugin, { esbuildPluginMonacoEditorNls, Languages } from 'vite-plugin-monaco-editor-nls'
export default defineConfig({
	plugins: [
		vue(),
		MonacoEditorNlsPlugin({locale: Languages.zh_hans})
	],
	optimizeDeps: {
		/** vite >= 2.3.0 */
		esbuildOptions: {
			plugins: [
				esbuildPluginMonacoEditorNls({
					locale: Languages.zh_hans,
				}),
			],
		},
	},
	build: {
		rollupOptions: {
			input: {
				main: resolve(__dirname, 'index.html'),
				shell: resolve(__dirname, 'shell.html')
			}
		}
	},
	server: {
		port: 3000,
		proxy: {
			'/api': { target: 'http://localhost:3010', ws: true },
			'/shell': 'http://localhost:3010',
			'/resources': 'http://localhost:3010'
		}
	}
})
