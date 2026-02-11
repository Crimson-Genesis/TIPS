// interviewer.js
let ws;
let pc;
let localStream;
let iceCandidatesQueue = [];
let remoteDescriptionSet = false;
let audioContext;
let analyser;
let dataArray;
let animationId;
let isActuallyRecording = false; // Track actual recording state

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusCandidate = document.getElementById('statusCandidate');
const statusRecording = document.getElementById('statusRecording');
const audioCanvas = document.getElementById('audioCanvas');
const canvasCtx = audioCanvas.getContext('2d');

startBtn.onclick = startRecording;
stopBtn.onclick = stopRecording;

function setupAudioVisualization() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(localStream);
    
    source.connect(analyser);
    analyser.fftSize = 2048;
    
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    console.log('✅ Audio visualizer started - THIS IS NOT RECORDING');
    drawWaveform();
}

function drawWaveform() {
    animationId = requestAnimationFrame(drawWaveform);
    
    analyser.getByteFrequencyData(dataArray);
    
    audioCanvas.width = audioCanvas.offsetWidth;
    audioCanvas.height = audioCanvas.offsetHeight;
    
    const gradient = canvasCtx.createLinearGradient(0, 0, 0, audioCanvas.height);
    gradient.addColorStop(0, '#00ff88');
    gradient.addColorStop(0.5, '#00ccff');
    gradient.addColorStop(1, '#667eea');
    
    canvasCtx.fillStyle = 'rgba(15, 12, 41, 0.3)';
    canvasCtx.fillRect(0, 0, audioCanvas.width, audioCanvas.height);
    
    const barWidth = (audioCanvas.width / dataArray.length) * 2.5;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * audioCanvas.height;
        
        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, audioCanvas.height - barHeight, barWidth - 2, barHeight);
        
        x += barWidth;
    }
}

async function autoConnect() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Your browser does not support media devices. Please use Chrome, Firefox, or Safari over HTTPS.');
            return;
        }
        
        console.log('🎤 Requesting microphone access...');
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000,
                channelCount: 2
            }
        });
        
        console.log('✅ Microphone access granted');
        setupAudioVisualization();
        
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${location.host}/ws`);
        
        ws.onopen = () => {
            console.log('🔌 WebSocket connected, joining as interviewer...');
            ws.send(JSON.stringify({ type: 'join-interviewer' }));
        };
        
        ws.onmessage = handleMessage;
        
        ws.onclose = () => {
            console.log('🔌 WebSocket disconnected');
            reset();
        };
        
    } catch (err) {
        alert('Failed to get audio: ' + err.message);
    }
}

async function handleMessage(event) {
    const msg = JSON.parse(event.data);
    console.log('📨 Received message:', msg);
    
    if (msg.type === 'joined') {
        await setupPeerConnection();
        statusCandidate.textContent = 'Waiting for candidate...';
        console.log('✅ Joined as interviewer, waiting for candidate...');
    }
    
    if (msg.type === 'answer') {
        const answer = new RTCSessionDescription({
            type: msg.sdpType,
            sdp: msg.sdp
        });
        await pc.setRemoteDescription(answer);
        remoteDescriptionSet = true;
        
        while (iceCandidatesQueue.length > 0) {
            const candidate = iceCandidatesQueue.shift();
            await pc.addIceCandidate(candidate);
        }
    }
    
    if (msg.type === 'state-update') {
        updateState(msg.state);
    }
    
    if (msg.type === 'stopped') {
        console.log('⏹️ Recording stopped by server');
        reset();
    }
}

async function setupPeerConnection() {
    pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });
    
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: event.candidate.toJSON()
            }));
        }
    };
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    ws.send(JSON.stringify({
        type: 'offer',
        sdp: pc.localDescription.sdp,
        sdpType: pc.localDescription.type
    }));
}

function updateState(state) {
    console.log('📊 State updated to:', state);
    
    if (state === 'BOTH_CONNECTED') {
        statusCandidate.textContent = 'Candidate Joined ✓';
        statusCandidate.classList.add('active');
        startBtn.disabled = false;
        stopBtn.disabled = true;
        statusRecording.textContent = 'Not Recording';
        statusRecording.classList.remove('active');
        statusRecording.classList.remove('recording-active');
        isActuallyRecording = false;
        console.log('✅ Candidate joined - START button now enabled');
    }
    
    if (state === 'RECORDING') {
        statusRecording.textContent = '🔴 RECORDING TO SERVER';
        statusRecording.classList.add('recording-active');
        statusRecording.classList.remove('active');
        startBtn.disabled = true;
        stopBtn.disabled = false;
        isActuallyRecording = true;
        console.log('🔴 RECORDING STARTED - Files are being saved to server');
    }
    
    if (state === 'INTERVIEWER_CONNECTED') {
        statusCandidate.textContent = 'Waiting for candidate...';
        statusCandidate.classList.remove('active');
        startBtn.disabled = true;
        stopBtn.disabled = true;
        statusRecording.textContent = 'Not Recording';
        statusRecording.classList.remove('active');
        statusRecording.classList.remove('recording-active');
        isActuallyRecording = false;
        console.log('⏳ Waiting for candidate to join...');
    }
    
    if (state === 'IDLE') {
        statusCandidate.textContent = 'No one connected';
        statusCandidate.classList.remove('active');
        startBtn.disabled = true;
        stopBtn.disabled = true;
        statusRecording.textContent = 'Not Recording';
        statusRecording.classList.remove('active');
        statusRecording.classList.remove('recording-active');
        isActuallyRecording = false;
    }
}

function startRecording() {
    console.log('🔴 START RECORDING button clicked - sending start command to server');
    ws.send(JSON.stringify({ type: 'start-recording' }));
}

function stopRecording() {
    console.log('⏹️ STOP RECORDING button clicked - sending stop command to server');
    ws.send(JSON.stringify({ type: 'stop-recording' }));
}

function reset() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    if (audioContext) {
        audioContext.close();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (pc) {
        pc.close();
    }
    if (ws) {
        ws.close();
    }
    
    canvasCtx.clearRect(0, 0, audioCanvas.width, audioCanvas.height);
    
    statusCandidate.textContent = 'Disconnected';
    statusCandidate.classList.remove('active');
    statusRecording.textContent = 'Not Recording';
    statusRecording.classList.remove('active');
    statusRecording.classList.remove('recording-active');
    
    startBtn.disabled = true;
    stopBtn.disabled = true;
    isActuallyRecording = false;
    
    console.log('🔄 Connection reset, reconnecting in 2 seconds...');
    
    // Auto-reconnect after 2 seconds
    setTimeout(() => {
        autoConnect();
    }, 2000);
}

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    updateToggleButton(true);
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateToggleButton(isDark);
}

function updateToggleButton(isDark) {
    const icon = document.querySelector('.theme-toggle-icon');
    const text = document.querySelector('.theme-toggle-text');
    
    if (isDark) {
        icon.textContent = '☀️';
        text.textContent = 'Light';
    } else {
        icon.textContent = '🌙';
        text.textContent = 'Dark';
    }
}

console.log('🚀 Interviewer page loaded - Auto-connecting...');
// Auto-connect when page loads
autoConnect();
