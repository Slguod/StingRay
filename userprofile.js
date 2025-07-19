// userprofile.js

import { EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js"; // Corrected URL
import { auth, db } from './firebase-init.js'; // Import auth and db (Firestore)

// Get references to the HTML elements
const fullNameElement = document.getElementById('profile-full-name');
const emailElement = document.getElementById('profile-email');
const phoneNumberElement = document.getElementById('profile-phone-number');
const joinedDateElement = document.getElementById('profile-joined-date');
const signOutLink = document.getElementById('sign-out-link');

// New elements for edit profile and change password
const editProfileLink = document.getElementById('edit-profile-link');
const changePasswordLink = document.getElementById('change-password-link');
const editProfileModal = document.getElementById('editProfileModal');
const changePasswordModal = document.getElementById('changePasswordModal');
const editProfileForm = document.getElementById('editProfileForm');
const changePasswordForm = document.getElementById('changePasswordForm');
const editFullNameInput = document.getElementById('edit-full-name');
const editPhoneNumberInput = document.getElementById('edit-phone-number');
const currentPasswordInput = document.getElementById('current-password');
const newPasswordInput = document.getElementById('new-password');
const confirmNewPasswordInput = document.getElementById('confirm-new-password');


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

                 // Populate edit profile form fields
                editFullNameInput.value = userData.fullName || '';
                editPhoneNumberInput.value = userData.phoneNumber || '';

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

// Open Edit Profile Modal
if (editProfileLink) {
editProfileLink.addEventListener('click', (e) => {
e.preventDefault();
editProfileModal.style.display = 'block';
});
}

// Handle Edit Profile Form Submission
if (editProfileForm) {
editProfileForm.addEventListener('submit', async (e) => {
e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
        alert("No user is signed in.");
        return;
    }

    const newFullName = editFullNameInput.value;
    const newPhoneNumber = editPhoneNumberInput.value;

    // Reference to the user's document in Firestore
    const userDocRef = doc(db, "users", user.uid);

    try {
        // Update only the fields that are allowed to be edited by the user
        await updateDoc(userDocRef, {
            fullName: newFullName,
            phoneNumber: newPhoneNumber
        });

        // Update the displayed information on the profile page
        fullNameElement.innerText = newFullName || 'N/A';
        phoneNumberElement.innerText = newPhoneNumber || 'N/A';

        alert("Profile updated successfully!");
        editProfileModal.style.display = 'none'; // Close the modal
    } catch (error) {
        console.error("Error updating profile:", error);
        alert("Error updating profile: " + error.message);
    }
});
}

// Open Change Password Modal
if (changePasswordLink) {
changePasswordLink.addEventListener('click', (e) => {
e.preventDefault();
changePasswordModal.style.display = 'block';
// Clear previous input values
currentPasswordInput.value = '';
newPasswordInput.value = '';
confirmNewPasswordInput.value = '';
});
}

// Handle Change Password Form Submission
if (changePasswordForm) {
changePasswordForm.addEventListener('submit', async (e) => {
e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
        alert("No user is signed in.");
        return;
    }

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;

    if (newPassword !== confirmNewPassword) {
        alert("New password and confirm password do not match.");
        return;
    }

    if (newPassword.length < 6) { // Firebase password minimum length
        alert("New password must be at least 6 characters long.");
        return;
    }

    try {
        // Re-authenticate the user before changing the password
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        console.log("User re-authenticated successfully.");

        // Update the password
        await updatePassword(user, newPassword);
        alert("Password changed successfully!");
        changePasswordModal.style.display = 'none'; // Close the modal
    } catch (error) {
        console.error("Error changing password:", error);
        if (error.code === 'auth/wrong-password') {
            alert("Incorrect current password. Please try again.");
        } else if (error.code === 'auth/requires-recent-login') {
            alert("This operation is sensitive and requires recent authentication. Please re-enter your current password.");
        } else {
            alert("Error changing password: " + error.message);
        }
    }
});
}
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