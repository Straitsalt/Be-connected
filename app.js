import { db, storage, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, ref, uploadBytes, getDownloadURL } from "./firebase-config.js";

let currentActiveUser = null;
let currentTargetFriend = null;
let isGhostModeActive = false;
let activeUnsubscribeListener = null;
let mediaRecorderInstance = null;
let recordedAudioChunks = [];
let isRegisterMode = false;

// 🔄 1. BOOTSTRAP LAYER INTEGRITY
window.onload = () => {
    const cachedUser = localStorage.getItem("connected_user");
    if (cachedUser) {
        initializeApplicationDashboard(cachedUser);
    }
};

window.toggleAuthMode = () => {
    isRegisterMode = !isRegisterMode;
    document.getElementById('authTitle').innerText = isRegisterMode ? "⚡ Create Node Account" : "⚡ Be-connected";
    document.getElementById('authBtn').innerText = isRegisterMode ? "Register & Enter" : "Enter System Matrix";
    document.getElementById('authToggleMsg').innerText = isRegisterMode ? "Already have a secure node? Login" : "Need a new account? Register here";
};

// 🔐 2. DYNAMIC AUTHENTICATION DATABASE CONTROLLER
window.executeAuthAction = async () => {
    const handle = document.getElementById('authHandle').value.trim().toLowerCase();
    const secret = document.getElementById('authSecret').value.trim();
    if (!handle || !secret) return alert("All credentials fields required.");

    const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    const accountRef = doc(db, "users", handle);
    const accountSnap = await getDoc(accountRef);

    if (isRegisterMode) {
        if (accountSnap.exists()) return alert("Handle already active in system database.");
        const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        await setDoc(accountRef, { password: secret, handle: handle });
        alert("Account verified and deployed!");
    } else {
        if (!accountSnap.exists() || accountSnap.data().password !== secret) {
            return alert("Invalid handle name or password profile.");
        }
    }
    initializeApplicationDashboard(handle);
};

function initializeApplicationDashboard(userHandle) {
    currentActiveUser = userHandle;
    localStorage.setItem("connected_user", userHandle);
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appWorkspace').classList.remove('hidden');
    document.getElementById('activeUserDisplay').innerText = `Node: @${userHandle}`;
    synchronizeUserDirectory();
}

window.executeLogOut = () => {
    localStorage.removeItem("connected_user");
    window.location.reload();
};

window.triggerPasswordModification = async () => {
    const newSecret = prompt("🔒 Enter your new secure password key:");
    if (!newSecret || newSecret.trim().length < 4) return alert("Action Cancelled: Invalid entry.");
    
    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    await updateDoc(doc(db, "users", currentActiveUser), { password: newSecret.trim() });
    alert("🚀 Success: Password updated instantly inside the cloud index!");
};

// 🔎 3. FIND FRIENDS FEED COMPILER (Compiles list into H3 triggers)
function synchronizeUserDirectory() {
    const dataQuery = query(collection(db, "users"));
    onSnapshot(dataQuery, (snapshot) => {
        window.allUsersCache = [];
        snapshot.forEach(doc => {
            if (doc.id !== currentActiveUser) window.allUsersCache.push(doc.data());
        });
        renderFriendsFeedList(window.allUsersCache);
    });
}

function renderFriendsFeedList(list) {
    const feed = document.getElementById('friendsFeedColumn');
    feed.innerHTML = '';
    
    list.forEach(account => {
        // Construct clean HTML block elements
        const block = document.createElement('div');
        block.className = 'friend-card';
        block.onclick = () => launchTargetConversation(account.handle);
        block.innerHTML = `<h3>@${escapeHTML(account.handle)}</h3>`;
        feed.appendChild(block);
    });
}

window.filterFriendsNetwork = () => {
    const term = document.getElementById('friendSearchInput').value.trim().toLowerCase();
    const matches = window.allUsersCache.filter(u => u.handle.includes(term));
    renderFriendsFeedList(matches);
};

// 💬 4. PEER-TO-PEER PRIVATE CHAT MATRIX INTERACTION ROUTINE
function launchTargetConversation(targetHandle) {
    currentTargetFriend = targetHandle;
    document.getElementById('currentChatHeadingHeader').innerText = `🛰️ Direct Secure Channel: @${targetHandle}`;
    document.getElementById('chatActionDashboard').classList.remove('hidden');
    
    if (activeUnsubscribeListener) activeUnsubscribeListener(); // Unbind past streams

    // Derive explicit Room ID by alpha sorting handles so it matches for both users
    const chatRoomId = [currentActiveUser, targetHandle].sort().join("_");
    const dataQuery = query(collection(db, `rooms/${chatRoomId}/messages`), orderBy("timestamp", "asc"));

    const chatBox = document.getElementById('chatStreamBox');
    
    activeUnsubscribeListener = onSnapshot(dataQuery, (snapshot) => {
        chatBox.innerHTML = '';
        snapshot.forEach((entry) => {
            const msgData = entry.data();
            const msgId = entry.id;
            
            const isOwn = msgData.user === currentActiveUser;
            const card = document.createElement('div');
            card.className = `msg-bubble ${isOwn ? 'own' : ''} ${msgData.disappearing ? 'disappearing' : ''}`;

            let ghostMarker = msgData.disappearing ? `<span class="ghost-badge">⏳ Vanishing Node (10s)</span>` : '';
            let contentPayload = `<div style="word-break: break-all;">${escapeHTML(msgData.text)}</div>`;

            if (msgData.mediaType?.startsWith('image/')) {
                contentPayload = `<img src="${msgData.mediaUrl}" class="msg-media" alt="Attachment">`;
            } else if (msgData.mediaType?.startsWith('video/')) {
                contentPayload = `<video src="${msgData.mediaUrl}" controls class="msg-media"></video>`;
            } else if (msgData.mediaType?.startsWith('audio/')) {
                contentPayload = `<audio src="${msgData.mediaUrl}" controls></audio>`;
            }

            card.innerHTML = `
                ${ghostMarker}
                <div class="msg-user">@${escapeHTML(msgData.user)}</div>
                ${contentPayload}
                <div class="msg-time">${new Date(msgData.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            `;
            chatBox.appendChild(card);
            
            if (msgData.disappearing) {
                setTimeout(async () => {
                    try {
                        await deleteDoc(doc(db, `rooms/${chatRoomId}/messages`, msgId));
                    } catch (err) { console.error("Self-destruct mismatch error:", err); }
                }, 10000);
            }
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// 📤 5. DATA INJECTION PACKET PROTOCOLS
window.sendTextMessage = async () => {
    const textInput = document.getElementById('messageInput');
    if (!textInput.value.trim() || !currentTargetFriend) return;

    const chatRoomId = [currentActiveUser, currentTargetFriend].sort().join("_");
    await addDoc(collection(db, `rooms/${chatRoomId}/messages`), {
        user: currentActiveUser,
        text: textInput.value.trim(),
        timestamp: Date.now(),
        disappearing: isGhostModeActive
    });
    textInput.value = '';
};

window.uploadMediaAsset = async (event) => {
    const localAsset = event.target.files[0];
    if (!localAsset || !currentTargetFriend) return;

    const chatRoomId = [currentActiveUser, currentTargetFriend].sort().join("_");
    const storagePathRef = ref(storage, `be_connected/${Date.now()}_${localAsset.name}`);
    try {
        const uploadSnapshot = await uploadBytes(storagePathRef, localAsset);
        const externalCloudUrl = await getDownloadURL(uploadSnapshot.ref);

        await addDoc(collection(db, `rooms/${chatRoomId}/messages`), {
            user: currentActiveUser,
            text: `Sent an attachment file`,
            mediaUrl: externalCloudUrl,
            mediaType: localAsset.type,
            timestamp: Date.now(),
            disappearing: isGhostModeActive
        });
    } catch (err) { alert("Asset storage transmission aborted."); }
};

window.toggleVoiceCapture = async () => {
    const recBtn = document.getElementById('audioRecordBtn');
    if (mediaRecorderInstance && mediaRecorderInstance.state === "recording") {
        mediaRecorderInstance.stop();
        recBtn.innerText = "🎙️ Record Voice";
        recBtn.classList.remove('recording');
        return;
    }

    try {
        const deviceMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderInstance = new MediaRecorder(deviceMicStream);
        recordedAudioChunks = [];

        mediaRecorderInstance.ondataavailable = (e) => recordedAudioChunks.push(e.data);
        mediaRecorderInstance.onstop = async () => {
            const rawAudioBlob = new Blob(recordedAudioChunks, { type: 'audio/webm' });
            const storagePathRef = ref(storage, `be_connected/voice_${Date.now()}.webm`);
            const chatRoomId = [currentActiveUser, currentTargetFriend].sort().join("_");

            const uploadSnapshot = await uploadBytes(storagePathRef, rawAudioBlob);
            const cloudUrl = await getDownloadURL(uploadSnapshot.ref);

            await addDoc(collection(db, `rooms/${chatRoomId}/messages`), {
                user: currentActiveUser,
                text: "Sent a voice message.",
                mediaUrl: cloudUrl,
                mediaType: "audio/webm",
                timestamp: Date.now(),
                disappearing: isGhostModeActive
            });
            deviceMicStream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderInstance.start();
        recBtn.innerText = "🛑 Stop & Send";
        recBtn.classList.add('recording');
    } catch (err) { alert("Mic framework link down."); }
};

window.toggleGhostMode = () => {
    isGhostModeActive = !isGhostModeActive;
    const btn = document.getElementById('ghostToggle');
    btn.innerText = isGhostModeActive ? "👻 Disappearing ON" : "👻 Disappearing Off";
    btn.classList.toggle('active', isGhostModeActive);
};

window.triggerAdminPurge = async () => {
    const pin = prompt("🛡️ Master System Admin Wipe Pin:");
    if (pin !== "ADMIN_MATRIX_99" || !currentTargetFriend) return alert("Operation unauthorized.");
    
    if (confirm("Wipe conversation database for this target stream node?")) {
        const chatRoomId = [currentActiveUser, currentTargetFriend].sort().join("_");
        const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const snapshot = await getDocs(collection(db, `rooms/${chatRoomId}/messages`));
        snapshot.forEach(entry => deleteDoc(doc(db, `rooms/${chatRoomId}/messages`, entry.id)));
    }
};

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                  }

