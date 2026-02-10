// candidate.js
let ws;
let pc;
let localStream;
let iceCandidatesQueue = [];
let remoteDescriptionSet = false;
let selectedDeviceId = null;
let audioContext;
let analyser;
let dataArray;
let animationId;

const joinBtn = document.getElementById("joinBtn");
const cameraSelect = document.getElementById("cameraSelect");
const localVideo = document.getElementById("localVideo");
const statusConnection = document.getElementById("statusConnection");
const statusRecording = document.getElementById("statusRecording");
const audioCanvas = document.getElementById("audioCanvas");
const canvasCtx = audioCanvas.getContext("2d");

joinBtn.onclick = join;
cameraSelect.onchange = handleCameraChange;

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

// function drawWaveform() {
//     animationId = requestAnimationFrame(drawWaveform);
//
//     analyser.getByteTimeDomainData(dataArray);
//
//     audioCanvas.width = audioCanvas.offsetWidth;
//     audioCanvas.height = audioCanvas.offsetHeight;
//
//     canvasCtx.fillStyle = 'rgb(0, 0, 0)';
//     canvasCtx.fillRect(0, 0, audioCanvas.width, audioCanvas.height);
//
//     canvasCtx.lineWidth = 2;
//     canvasCtx.strokeStyle = 'rgb(0, 255, 0)';
//     canvasCtx.beginPath();
//
//     const sliceWidth = audioCanvas.width / dataArray.length;
//     let x = 0;
//
//     for (let i = 0; i < dataArray.length; i++) {
//         const v = dataArray[i] / 128.0;
//         const y = v * audioCanvas.height / 2;
//
//         if (i === 0) {
//             canvasCtx.moveTo(x, y);
//         } else {
//             canvasCtx.lineTo(x, y);
//         }
//
//         x += sliceWidth;
//     }
//
//     canvasCtx.lineTo(audioCanvas.width, audioCanvas.height / 2);
//     canvasCtx.stroke();
// }

function drawWaveform() {
  animationId = requestAnimationFrame(drawWaveform);

  analyser.getByteFrequencyData(dataArray);

  audioCanvas.width = audioCanvas.offsetWidth;
  audioCanvas.height = audioCanvas.offsetHeight;

  const gradient = canvasCtx.createLinearGradient(0, 0, 0, audioCanvas.height);
  gradient.addColorStop(0, "#00ff88");
  gradient.addColorStop(0.5, "#00ccff");
  gradient.addColorStop(1, "#667eea");

  canvasCtx.fillStyle = "rgba(15, 12, 41, 0.3)";
  canvasCtx.fillRect(0, 0, audioCanvas.width, audioCanvas.height);

  const barWidth = (audioCanvas.width / dataArray.length) * 2.5;
  let x = 0;

  for (let i = 0; i < dataArray.length; i++) {
    const barHeight = (dataArray[i] / 255) * audioCanvas.height;

    canvasCtx.fillStyle = gradient;
    canvasCtx.fillRect(
      x,
      audioCanvas.height - barHeight,
      barWidth - 2,
      barHeight,
    );

    x += barWidth;
  }
}

async function loadCameras() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert(
        "Your browser does not support media devices. Please use Chrome, Firefox, or Safari over HTTPS.",
      );
      cameraSelect.innerHTML =
        '<option value="">Browser not supported</option>';
      joinBtn.disabled = true;
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(
      (device) => device.kind === "videoinput",
    );

    cameraSelect.innerHTML = "";

    if (videoDevices.length === 0) {
      cameraSelect.innerHTML = '<option value="">No cameras found</option>';
      return;
    }

    videoDevices.forEach((device, index) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.text = device.label || `Camera ${index + 1}`;
      cameraSelect.appendChild(option);
    });

    selectedDeviceId = videoDevices[0].deviceId;

    await startPreview();
  } catch (err) {
    console.error("Error loading cameras:", err);
    cameraSelect.innerHTML = '<option value="">Error loading cameras</option>';
  }
}

// Load saved theme
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark-mode");
  updateToggleButton(true);
}

function toggleTheme() {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  updateToggleButton(isDark);
}

function updateToggleButton(isDark) {
  const icon = document.querySelector(".theme-toggle-icon");
  const text = document.querySelector(".theme-toggle-text");

  if (isDark) {
    icon.textContent = "☀️";
    text.textContent = "Light";
  } else {
    icon.textContent = "🌙";
    text.textContent = "Dark";
  }
}

async function startPreview() {
  try {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    if (audioContext) {
      audioContext.close();
    }

    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2,
      },
      video: {
        deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = localStream;

    setupAudioVisualization();
  } catch (err) {
    alert("Failed to access camera: " + err.message);
  }
}

async function handleCameraChange() {
  selectedDeviceId = cameraSelect.value;
  await startPreview();
}

async function join() {
  if (!localStream) {
    alert("Please wait for camera to load");
    return;
  }

  try {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocol}//${location.host}/ws`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join-candidate" }));
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      reset();
    };
  } catch (err) {
    alert("Failed to connect: " + err.message);
  }
}

async function handleMessage(event) {
  const msg = JSON.parse(event.data);

  if (msg.type === "error") {
    alert(msg.message);
    reset();
    return;
  }

  if (msg.type === "joined") {
    await setupPeerConnection();
    statusConnection.textContent = "Connected";
    statusConnection.classList.add("active");
    joinBtn.disabled = true;
    cameraSelect.disabled = true;
  }

  if (msg.type === "answer") {
    const answer = new RTCSessionDescription({
      type: msg.sdpType,
      sdp: msg.sdp,
    });
    await pc.setRemoteDescription(answer);
    remoteDescriptionSet = true;

    while (iceCandidatesQueue.length > 0) {
      const candidate = iceCandidatesQueue.shift();
      await pc.addIceCandidate(candidate);
    }
  }

  if (msg.type === "state-update") {
    updateState(msg.state);
  }

  if (msg.type === "stopped") {
    reset();
  }
}

async function setupPeerConnection() {
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(
        JSON.stringify({
          type: "ice-candidate",
          candidate: event.candidate.toJSON(),
        }),
      );
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  ws.send(
    JSON.stringify({
      type: "offer",
      sdp: pc.localDescription.sdp,
      sdpType: pc.localDescription.type,
    }),
  );
}

function updateState(state) {
  if (state === "RECORDING") {
    statusRecording.textContent = "RECORDING";
    statusRecording.classList.add("active");
  } else {
    statusRecording.textContent = "Not Recording";
    statusRecording.classList.remove("active");
  }
}

function reset() {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (audioContext) {
    audioContext.close();
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  if (pc) {
    pc.close();
  }
  if (ws) {
    ws.close();
  }

  localVideo.srcObject = null;
  canvasCtx.clearRect(0, 0, audioCanvas.width, audioCanvas.height);

  statusConnection.textContent = "Not Connected";
  statusConnection.classList.remove("active");
  statusRecording.textContent = "Not Recording";
  statusRecording.classList.remove("active");

  joinBtn.disabled = false;
  cameraSelect.disabled = false;

  loadCameras();
}

loadCameras();
