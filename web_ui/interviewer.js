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

const connectBtn = document.getElementById('connectBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusConnection = document.getElementById('statusConnection');
const statusCandidate = document.getElementById('statusCandidate');
const statusRecording = document.getElementById('statusRecording');
const audioCanvas = document.getElementById('audioCanvas');
const canvasCtx = audioCanvas.getContext('2d');

connectBtn.onclick = connect;
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

async function connect() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Your browser does not support media devices. Please use Chrome, Firefox, or Safari over HTTPS.');
            return;
        }
        
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000,
                channelCount: 2
            }
        });
        
        setupAudioVisualization();
        
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${location.host}/ws`);
        
        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'join-interviewer' }));
        };
        
        ws.onmessage = handleMessage;
        
        ws.onclose = () => {
            reset();
        };
        
    } catch (err) {
        alert('Failed to get audio: ' + err.message);
    }
}

async function handleMessage(event) {
    const msg = JSON.parse(event.data);
    
    if (msg.type === 'joined') {
        await setupPeerConnection();
        statusConnection.textContent = 'Connected';
        statusConnection.classList.add('active');
        connectBtn.disabled = true;
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
    if (state === 'BOTH_CONNECTED') {
        statusCandidate.textContent = 'Candidate Joined';
        statusCandidate.classList.add('active');
        startBtn.disabled = false;
    }
    
    if (state === 'RECORDING') {
        statusRecording.textContent = 'RECORDING';
        statusRecording.classList.add('active');
        startBtn.disabled = true;
        stopBtn.disabled = false;
    }
    
    if (state === 'INTERVIEWER_CONNECTED') {
        statusCandidate.textContent = 'Candidate Not Joined';
        statusCandidate.classList.remove('active');
        startBtn.disabled = true;
    }
}

function startRecording() {
    ws.send(JSON.stringify({ type: 'start-recording' }));
}

function stopRecording() {
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
    
    statusConnection.textContent = 'Not Connected';
    statusConnection.classList.remove('active');
    statusCandidate.textContent = 'Candidate Not Joined';
    statusCandidate.classList.remove('active');
    statusRecording.textContent = 'Not Recording';
    statusRecording.classList.remove('active');
    
    connectBtn.disabled = false;
    startBtn.disabled = true;
    stopBtn.disabled = true;
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
