import axios from 'axios';

// ที่อยู่เซิร์ฟเวอร์: ตอนใช้งานจริงตั้งค่า VITE_API_URL ไว้ใน Cloudflare Pages
// (เช่น https://ชื่อบริการ.onrender.com/api) ถ้าไม่ตั้งจะใช้เครื่องตัวเองตอนพัฒนา
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // เซิร์ฟเวอร์ฟรีของ Render จะหลับเมื่อไม่มีคนใช้ ตอนปลุกใช้เวลาราว 1 นาที
  // จึงรอได้นานขึ้นแทนที่จะขึ้น error ทั้งที่แค่ยังตื่นไม่เสร็จ
  timeout: 90000,
});

// แนบ Token ไปกับ Header อัตโนมัติถ้ามี (สำหรับหน้า Vault)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;