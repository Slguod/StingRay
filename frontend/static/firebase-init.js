import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA_cKhQVOsqbf4gO2W9ZDkS5YD5Y2X9yJ4",
    authDomain: "stingray-6f47a.firebaseapp.com",
    projectId: "stingray-6f47a",
    storageBucket: "stingray-6f47a.firebasestorage.app",
    messagingSenderId: "631922302179",
    appId: "1:631922302179:web:86281c60823f3d232d79d6",
    measurementId: "G-WQ7FK4G2TX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);