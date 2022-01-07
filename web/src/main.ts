import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import App from './App.vue'
import * as ElIconModules from '@element-plus/icons-vue'
import './assets/FA5Pro/fontawesome.css'
import './assets/base.scss'
import './assets/os.iconfont.js'

const app = createApp(App)
// 屏蔽错误信息
app.config.errorHandler = () => null;
// 屏蔽警告信息
app.config.warnHandler = () => null;
//  引入icon
for(let iconName in ElIconModules){
	app.component(
		'i' + iconName.replace(/[A-Z]/g,(match)=>'-'+match.toLowerCase()),
		(ElIconModules as any)[iconName]
	)
}
app.use(ElementPlus, { size: 'default', zIndex: 3000, locale: zhCn }).mount('#app')
