import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// ✨ 1. Đổi BrowserRouter thành HashRouter ở đây
import { HashRouter } from 'react-router-dom'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* ✨ 2. Đổi ở đây nữa */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)