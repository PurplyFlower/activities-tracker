/* BUILD: v5 */
console.log("CLEAN BUILD LOADED");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } 
  from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import { getFirestore } 
  from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// IMPORTANT: your firebase-config.js must define firebaseConfig
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
getFirestore(app);

const root = document.getElementById("app");

function renderAuth() {
  root.innerHTML = `
    <h1>Welcome</h1>
    <p>Please log in or create an account to get started.</p>
    <input id="email" placeholder="Email" /><br/><br/>
    <input id="pass" type="password" placeholder="Password" /><br/><br/>
    <button id="loginBtn">Login</button>
    <button id="signupBtn">Create Account</button>
  `;

  document.getElementById("loginBtn").onclick = async () => {
    const e = document.getElementById("email").value;
    const p = document.getElementById("pass").value;
    await signInWithEmailAndPassword(auth, e, p);
  };

  document.getElementById("signupBtn").onclick = async () => {
    const e = document.getElementById("email").value;
    const p = document.getElementById("pass").value;
    await createUserWithEmailAndPassword(auth, e, p);
  };
}

function renderApp(user) {
  root.innerHTML = `<h1>Logged in as ${user.email}</h1>`;
}

onAuthStateChanged(auth, (user) => {
  if (!user) renderAuth();
  else renderApp(user);
});
