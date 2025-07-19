// userprofile.js

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { auth, db } from './firebase-init.js'; // Import auth and db (Firestore)


// Get references to the HTML elements
const fullNameElement = document.getElementById('profile-full-name');
const emailElement = document.getElementById('profile-email');
const phoneNumberElement = document.getElementById('profile-phone-number');
const joinedDateElement = document.getElementById('profile-joined-date');
const signOutLink = document.getElementById('sign-out-link');


// Listener for Firebase Auth state changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in, fetch their details from Firestore
        console.log("User is signed in:", user.uid);

        // Reference to the user's document in the "users" collection
        const userDocRef = doc(db, "users", user.uid);

        try {
            const docSnap = await getDoc(userDocRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                console.log("User data from Firestore:", userData);

                // Populate the HTML elements with fetched data
                fullNameElement.innerText = userData.fullName || 'N/A';
                emailElement.innerText = userData.email || 'N/A';
                phoneNumberElement.innerText = userData.phoneNumber || 'N/A';

                // Format the joined date if available
                const joinedTimestamp = user.metadata.creationTime;
                if (joinedTimestamp) {
                    const date = new Date(joinedTimestamp);
                    joinedDateElement.innerText = date.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                } else {
                    joinedDateElement.innerText = 'N/A';
                }

            } else {
                // Document does not exist for the user
                console.log("No additional user profile document found for UID:", user.uid);
                alert("Your profile data could not be found. Please contact support.");
                // Optionally, populate with just Firebase Auth email
                emailElement.innerText = user.email || 'N/A';
                fullNameElement.innerText = user.displayName || 'N/A (Update Profile)';
            }
        } catch (error) {
            console.error("Error fetching user profile from Firestore:", error);
            alert("Error loading profile data: " + error.message);
        }
    } else {
        // User is signed out or no user logged in
        console.log("No user signed in. Redirecting to login page.");
        // Redirect to login page if no user is authenticated
        window.location.href = "/login";
    }
});


// Add sign out functionality
if (signOutLink) {
    signOutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            console.log("User signed out successfully.");
            alert("You have been signed out.");
            window.location.href = "/login"; // Redirect to login page after sign out
        } catch (error) {
            console.error("Error signing out:", error);
            alert("Error signing out: " + error.message);
        }
    });
}