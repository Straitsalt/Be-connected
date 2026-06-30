import { db, storage, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, ref, uploadBytes, getDownloadURL } from "./firebase-config.js";

let isGhostModeActive = false;
let mediaRecorderInstance = null;
let recordedAudioChunks = [];

window.onload = () => {
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

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

