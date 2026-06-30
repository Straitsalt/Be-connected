import { db, storage, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, ref, uploadBytes, getDownloadURL } from "./firebase-config.js";

// 🛡️ SECURITY LAYER PASSCODES (Change these values to whatever you want!)
const FRIENDS_ACCESS_PASSCODE = "CSK_2026_WIN"; 
const MASTER_ADMIN_PIN = "ADMIN_MATRIX_99";

let isGhostModeActive = false;
let mediaRecorderInstance = null;
let recordedAudioChunks = [];

// 🔒 GATEWAY ENGINE: Prompts for password before letting user into the chat matrix
window.onload = () => {
    let sessionKey = localStorage.getItem("chat_authorized");
    
    while (sessionKey !== FRIENDS_ACCESS_PASSCODE) {
        let entryPrompt = prompt("🛡️ Enter Be-connected Access Passcode:");
        if (entryPrompt === FRIENDS_ACCESS_PASSCODE) {
            localStorage.setItem("chat_authorized", FRIENDS_ACCESS_PASSCODE);
            sessionKey = FRIENDS_ACCESS_PASSCODE;
        } else if (entryPrompt === null) {
            // User hit cancel
            document.body.innerHTML = `<div style="color: #EF4444; padding: 40px; text-align: center; font-family: sans-serif;"><h3>Access Denied</h3>Refresh the page to try again.</div>`;
            return;
        } else {
            alert("❌ Access Denied: Incorrect Link Code.");
        }
    }
    
    // If authorization passes, initialize listener stream connection
    subscribeToLiveChatStream();
};

window.toggleGhostMode = () => {
    isGhostModeActive = !isGhostModeActive;
    const btn = document.getElementById('ghostToggle');
    if (isGhostModeActive) {
        btn.innerText = "👻 Disappearing ON";
        btn.classList.add('active');
    } else {
        btn.innerText = "👻 Disappearing Off";
        btn.classList.remove('active');
    }
};

function subscribeToLiveChatStream() {
    const chatBox = document.getElementById('chatStreamBox');
    const dataQuery = query(collection(db, "messages"), orderBy("timestamp", "asc"));

    onSnapshot(dataQuery, (snapshot) => {
        chatBox.innerHTML = '';
        
        snapshot.forEach((entry) => {
            const msgData = entry.data();
            const msgId = entry.id;
            const currentUser = document.getElementById('usernameInput').value;
            
            const isOwn = msgData.user === currentUser;
            const card = document.createElement('div');
            card.className = `msg-bubble ${isOwn ? 'own' : ''} ${msgData.disappearing ? 'disappearing' : ''}`;

            let ghostMarker = msgData.disappearing ? `<span class="ghost-badge">⏳ Vanishing Node (10s)</span>` : '';
            let contentPayload = `<div style="word-break: break-all;">${escapeHTML(msgData.text)}</div>`;

            if (msgData.mediaType?.startsWith('image/')) {
                contentPayload = `<img src="${msgData.mediaUrl}" class="msg-media" alt="Shared Image">`;
            } else if (msgData.mediaType?.startsWith('video/')) {
                contentPayload = `<video src="${msgData.mediaUrl}" controls class="msg-media"></video>`;
            } else if (msgData.mediaType?.startsWith('audio/')) {
                contentPayload = `<audio src="${msgData.mediaUrl}" controls></audio>`;
            }

            card.innerHTML = `
                ${ghostMarker}
                <div class="msg-user">${escapeHTML(msgData.user)}</div>
                ${contentPayload}
                <div class="msg-time">${new Date(msgData.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            `;
            chatBox.appendChild(card);
            
            if (msgData.disappearing) {
                setTimeout(async () => {
                    try {
                        await deleteDoc(doc(db, "messages", msgId));
                    } catch (err) { console.error("Self-destruct failed:", err); }
                }, 10000);
            }
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

window.sendTextMessage = async () => {
    const textInput = document.getElementById('messageInput');
    const currentUser = document.getElementById('usernameInput').value;
    if (!textInput.value.trim()) return;

    await addDoc(collection(db, "messages"), {
        user: currentUser,
        text: textInput.value.trim(),
        timestamp: Date.now(),
        disappearing: isGhostModeActive
    });
    textInput.value = '';
};

window.uploadMediaAsset = async (event) => {
    const localAsset = event.target.files[0];
    const currentUser = document.getElementById('usernameInput').value;
    if (!localAsset) return;

    const storagePathRef = ref(storage, `social_media/${Date.now()}_${localAsset.name}`);
    try {
        const uploadSnapshot = await uploadBytes(storagePathRef, localAsset);
        const externalCloudUrl = await getDownloadURL(uploadSnapshot.ref);

        await addDoc(collection(db, "messages"), {
            user: currentUser,
            text: `Sent a file attachment`,
            mediaUrl: externalCloudUrl,
            mediaType: localAsset.type,
            timestamp: Date.now(),
            disappearing: isGhostModeActive
        });
    } catch (err) { alert("File upload execution block failed."); }
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
            const storagePathRef = ref(storage, `social_media/voice_${Date.now()}.webm`);
            const currentUser = document.getElementById('usernameInput').value;

            const uploadSnapshot = await uploadBytes(storagePathRef, rawAudioBlob);
            const cloudUrl = await getDownloadURL(uploadSnapshot.ref);

            await addDoc(collection(db, "messages"), {
                user: currentUser,
                text: "Sent a voice message.",
                mediaUrl: cloudUrl,
                mediaType: "audio/webm",
                timestamp: Date.now(),
                disappearing: isGhostModeActive
            });
            deviceMicStream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderInstance.start();
        recBtn.innerText = "🛑 Stop Recording";
        recBtn.classList.add('recording');
    } catch (err) { alert("Mic hardware channel access denied."); }
};

// 💥 ADMINISTRATIVE PURGE LAYER: Deletes database history instantly
window.triggerAdminPurge = async () => {
    let verification = prompt("🔒 Enter Master Admin Clearance Pin to Wipe Chat:");
    if (verification !== MASTER_ADMIN_PIN) {
        alert("❌ Access Denied: Invalid Administrative Credentials.");
        return;
    }

    if (!confirm("⚠️ WARNING: This will permanently wipe the entire conversation history for everyone. Proceed?")) return;

    const chatBox = document.getElementById('chatStreamBox');
    chatBox.innerHTML = '<div style="color: #EF4444; text-align: center; font-weight: bold;">Executing Data Purge...</div>';

    try {
        const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const querySnapshot = await getDocs(collection(db, "messages"));
        
        const deletePromises = [];
        querySnapshot.forEach((entry) => {
            deletePromises.push(deleteDoc(doc(db, "messages", entry.id)));
        });

        await Promise.all(deletePromises);
        alert("💥 Success: Chat database completely wiped clear.");
    } catch (err) {
        console.error(err);
        alert("Execution Error: Could not clear database documents.");
    }
};

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

