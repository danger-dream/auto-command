import { resolve } from 'path'
import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
	plugins: [vue()],
	build: {
		rollupOptions: {
			input: {
				main: resolve(__dirname, 'index.html'),
				webssh: resolve(__dirname, 'webssh.html')
			}
		}
	},
	server: {
		port: 3000,
		proxy: {
			'/api': { target: 'http://localhost:3010', ws: true }
		}
	}
})