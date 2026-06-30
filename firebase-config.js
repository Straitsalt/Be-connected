import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// 🛠️ REPLACE THIS ENTIRE OBJECT WITH YOUR WEB APP CONFIG FROM FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyA5XjXpWQ9qPA8ZaZxyex41KZaZ7iN8n38",
  authDomain: "be-connected-bddc7.firebaseapp.com",
  projectId: "be-connected-bddc7",
  storageBucket: "be-connected-bddc7.firebasestorage.app",
  messagingSenderId: "834647287528",
  appId: "1:834647287528:web:de09e200ef16498d3b0b5d",
  measurementId: "G-3LWCGNZ2NX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

export { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, ref, uploadBytes, getDownloadURL };

