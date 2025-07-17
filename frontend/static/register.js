// register.js

import { auth } from './firebase-init.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

const registerBtn = document.getElementById('register-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

if (registerBtn) {
    registerBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            alert("Account created successfully! You can now log in.");
            window.location.href = "/login";
        } catch (error) {
            console.error(error);
            alert("Error creating account: " + error.message);
        }
    });
}