import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";





const firebaseConfig = {
    apiKey: "AIzaSyA_cKhQVOsqbf4gO2W9ZDkS5YD5Y2X9yJ4",
    authDomain: "stingray-6f47a.firebaseapp.com",
    projectId: "stingray-6f47a",
    storageBucket: "stingray-6f47a.firebasestorage.app",
    messagingSenderId: "631922302179",
    appId: "1:631922302179:web:86281c60823f3d232d79d6",
    measurementId: "G-WQ7FK4G2TX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

