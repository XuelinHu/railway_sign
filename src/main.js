import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import { finishOidc } from './services/auth.js'
import './styles/theme.css'

const mount = () => createApp(App).use(router).mount('#app')

if (window.location.pathname === '/oidc/callback') {
  const params = new URLSearchParams(window.location.search)
  finishOidc({ code: params.get('code'), state: params.get('state') })
    .then((result) => {
      window.history.replaceState(null, '', `${window.location.origin}/`)
      window.location.hash = result.mode === 'link' ? '/profile' : '/'
    })
    .catch((error) => {
      sessionStorage.setItem('railway_sign_oidc_error', error.message)
      window.history.replaceState(null, '', `${window.location.origin}/`)
      window.location.hash = '/login'
    })
    .finally(mount)
} else {
  mount()
}
