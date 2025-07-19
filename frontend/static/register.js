// register.js

import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { auth, db } from './firebase-init.js';

const registerBtn = document.getElementById('register-btn');
const fullNameInput = document.getElementById('full-name');
const emailInput = document.getElementById('email');
const phoneNumberInput = document.getElementById('phone-number');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');

if (registerBtn) {
    registerBtn.addEventListener("click", async (e) => {
        e.preventDefault(); // Prevent default form submission

        const fullName = fullNameInput.value.trim(); // Trim whitespace
        const email = emailInput.value.trim();
        const phoneNumber = phoneNumberInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Basic client-side validation for empty fields
        if (!fullName || !email || !phoneNumber || !password || !confirmPassword) {
            alert("Please fill in all fields.");
            return;
        }

        if (password.length < 6) { // Firebase requires at least 6 characters for password
            alert("Password should be at least 6 characters.");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        try {
            // 1. Create user with email and password in Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log("Firebase Auth user created:", user.uid); // Log user UID

            // 2. Save additional user details to Firestore using the user's UID
            // Ensure this awaits completion
            await setDoc(doc(db, "users", user.uid), {
                fullName: fullName,
                email: email,
                phoneNumber: phoneNumber,
                createdAt: new Date().toISOString() // Optional: add creation timestamp
            });
            console.log("User details saved to Firestore for UID:", user.uid); // Log successful Firestore write

            alert("Account created successfully! Redirecting to user profile.");
            // Redirect to user profile after both auth creation and Firestore write are successful
            window.location.href = "/userprofile"; // Changed redirection to userprofile
            
        } catch (error) {
            console.error("Error during registration:", error); // Log the full error
            let errorMessage = "An error occurred during registration. Please try again.";

            // Provide more specific error messages based on Firebase error codes
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "The email address is already in use by another account.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "The email address is not valid.";
            } else if (error.code === 'auth/operation-not-allowed') {
                errorMessage = "Email/password accounts are not enabled. Please check Firebase settings.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "The password is too weak.";
            }
            alert("Error: " + errorMessage + "\nDetails: " + error.message);
        }
    });
}