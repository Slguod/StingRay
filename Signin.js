import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";



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

//submit button
const submit = document.getElementById('submit');
submit.addEventListener("click", function (event) {
  event.preventDefault()

  //Inputs
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      // Signed up 
      const user = userCredential.user;
      alert("Logging in")
      window.location.href = "mainpage.html";
      //...
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      alert(errorMessage)
      //..
    });
})
