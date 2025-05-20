import axios from 'axios';

// 設置全局默認配置
axios.defaults.baseURL = 'http://localhost:8000'; // 後端 API 的基礎 URL
axios.defaults.withCredentials = true; // 允許跨域攜帶 cookie
axios.defaults.headers.common['Content-Type'] = 'application/json'; // 默認 Content-Type
axios.defaults.headers.common['Accept'] = 'application/json'; // 默認 Accept

export default axios;