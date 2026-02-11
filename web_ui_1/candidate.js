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

// Local recording variables
let mediaRecorder;
let recordedChunks = [];
let isLocalRecording = false;
let recordingStartTime = null;

const joinBtn = document.getElementById("joinBtn");
const cameraSelect = document.getElementById("cameraSelect");
const localVideo = document.getElementById("localVideo");
const statusConnection = document.getElementById("statusConnection");
const statusRecording = document.getElementById("statusRecording");
const audioCanvas = document.getElementById("audioCanvas");
const canvasCtx = audioCanvas.getContext("2d");
const localRecordBtn = document.getElementById("localRecordBtn");
const localRecordingIndicator = document.getElementById(
  "localRecordingIndicator",
);

joinBtn.onclick = join;
cameraSelect.onchange = handleCameraChange;
localRecordBtn.onclick = toggleLocalRecording;

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
      localRecordBtn.disabled = true;
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

    // Optimized constraints for consistent recording
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
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 30 }, // Lock framerate to 30fps
      },
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = localStream;

    // Verify the actual settings
    const videoTrack = localStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    console.log("Video settings:", settings);

    setupAudioVisualization();
  } catch (err) {
    alert("Failed to access camera: " + err.message);
  }
}

async function handleCameraChange() {
  selectedDeviceId = cameraSelect.value;

  // Stop local recording if active
  if (isLocalRecording) {
    stopLocalRecording();
  }

  await startPreview();
}

function toggleLocalRecording() {
  if (!localStream) {
    alert("Please wait for camera to load");
    return;
  }

  if (!isLocalRecording) {
    startLocalRecording();
  } else {
    stopLocalRecording();
  }
}

function startLocalRecording() {
  recordedChunks = [];
  recordingStartTime = Date.now();

  // Use more conservative bitrates for stable recording
  let options;
  if (MediaRecorder.isTypeSupported("video/webm;codecs=h264,opus")) {
    // H.264 is more stable and widely supported
    options = {
      mimeType: "video/webm;codecs=h264,opus",
      videoBitsPerSecond: 8000000, // 8 Mbps for 1080p30
      audioBitsPerSecond: 192000, // 192 kbps
    };
  } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
    options = {
      mimeType: "video/webm;codecs=vp9,opus",
      videoBitsPerSecond: 6000000, // 6 Mbps for VP9
      audioBitsPerSecond: 192000,
    };
  } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
    options = {
      mimeType: "video/webm;codecs=vp8,opus",
      videoBitsPerSecond: 8000000, // 8 Mbps for VP8
      audioBitsPerSecond: 192000,
    };
  } else {
    // Fallback to default codec
    options = {
      videoBitsPerSecond: 8000000,
      audioBitsPerSecond: 192000,
    };
  }

  try {
    mediaRecorder = new MediaRecorder(localStream, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
        console.log(`Chunk received: ${event.data.size} bytes at ${Date.now() - recordingStartTime}ms`);
      }
    };

    mediaRecorder.onstop = () => {
      if (recordedChunks.length === 0) {
        console.error("No data recorded");
        alert("Recording failed: No data captured");
        return;
      }

      const mimeType = options.mimeType || "video/webm";
      const blob = new Blob(recordedChunks, { type: mimeType });
      
      console.log(`Recording stopped. Total size: ${blob.size} bytes, Duration: ${Date.now() - recordingStartTime}ms`);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Use consistent timestamp format
      const now = new Date();
      const timestamp = now.getFullYear() + 
                       String(now.getMonth() + 1).padStart(2, '0') + 
                       String(now.getDate()).padStart(2, '0') + '_' +
                       String(now.getHours()).padStart(2, '0') + 
                       String(now.getMinutes()).padStart(2, '0') + 
                       String(now.getSeconds()).padStart(2, '0');
      
      const extension = mimeType.includes('webm') ? 'webm' : 'mp4';
      a.download = `interview-recording-${timestamp}.${extension}`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 100);
      recordedChunks = [];
    };

    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event.error);
      alert("Recording error: " + event.error);
      stopLocalRecording();
    };

    // Start recording with NO timeslice parameter to avoid chunking issues
    // This ensures continuous recording without frame drops
    mediaRecorder.start();
    
    isLocalRecording = true;

    localRecordBtn.textContent = "Stop Local Recording";
    localRecordBtn.classList.add("recording");
    localRecordingIndicator.classList.add("active");

    console.log("Local recording started with options:", options);
    console.log("MediaRecorder state:", mediaRecorder.state);
  } catch (err) {
    alert("Failed to start local recording: " + err.message);
    console.error("Recording error:", err);
  }
}

function stopLocalRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    console.log("Stopping recording...");
    mediaRecorder.stop();
    isLocalRecording = false;

    localRecordBtn.textContent = "Start Local Recording";
    localRecordBtn.classList.remove("recording");
    localRecordingIndicator.classList.remove("active");

    console.log("Local recording stopped");
  }
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
  if (isLocalRecording) {
    stopLocalRecording();
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

// Theme toggle functions
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

loadCameras();
