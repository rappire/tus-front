"use strict";

let upload = null;
let mr = null;
let stream = null;
let recordingState = "inactive"; // "inactive" | "recording" | "paused"

const recordBtn = document.querySelector("#record-btn");
const stopBtn = document.querySelector("#stop-btn");
const alertBox = document.querySelector("#support-alert");
const progressBox = document.querySelector("#progress-note");
const uploadList = document.querySelector("#upload-list");
const chunkInput = document.querySelector("#chunksize");
const endpointInput = document.querySelector("#endpoint");
const counselSessionIdInput = document.querySelector("#counselSessionId");
const tokenInput = document.querySelector("#token");

if (!tus.isSupported) {
  alertBox.classList.remove("d-none");
}

recordBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  if (recordingState === "inactive") {
    recordBtn.textContent = "Pause Recording";
    stopBtn.disabled = false;
    await startStreamUpload();
  } else if (recordingState === "recording") {
    mr.pause();
    recordingState = "paused";
    recordBtn.textContent = "Resume Recording";
  } else if (recordingState === "paused") {
    mr.resume();
    recordingState = "recording";
    recordBtn.textContent = "Pause Recording";
  }
});

stopBtn.addEventListener("click", () => {
  if (mr && recordingState !== "inactive") {
    mr.stop();
    stream.getTracks().forEach((t) => t.stop());
    recordingState = "inactive";
    recordBtn.textContent = "Start Recording";
    stopBtn.disabled = true;
  }
});

function startUpload(fileStream) {
  const endpoint = endpointInput.value;
  let chunkSize = parseInt(chunkInput.value, 10);
  if (Number.isNaN(chunkSize)) {
    chunkSize = Infinity;
  }

  const options = {
    resume: false,
    endpoint,
    chunkSize,
    uploadLengthDeferred: true,
    retryDelays: [0, 1000, 3000, 5000],
    headers: {
      Authorization: tokenInput.value,
    },
    metadata: {
      filename: "audio.webm",
      filetype: "audio/webm",
      counselSessionId: counselSessionIdInput.value,
    },
    onError(error) {
      console.error(error);
      alert(`Upload error: ${error}`);
      reset();
    },
    onProgress(bytesUploaded) {
      progressBox.textContent = `Uploaded ${bytesUploaded} bytes so far.`;
    },
    onSuccess() {
      // fetch(`http://localhost:8080/files/merge?counselSessionId=${encodeURIComponent(counselSessionIdInput.value)}`);
      const li = document.createElement("li");
      li.className = "list-group-item";
      li.textContent = `✅ Upload completed: audio.webm`;
      uploadList.appendChild(li);
      reset();
    },
  };

  upload = new tus.Upload(fileStream, options);
  upload.start();
}

function startStreamUpload() {
  return navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((s) => {
      stream = s;
      mr = new MediaRecorder(stream);
      const chunks = [];
      let done = false;
      let onDataAvailable = null;

      mr.onerror = onError;
      mr.onstop = () => {
        done = true;
        if (onDataAvailable) onDataAvailable(readableRecorder.read());
      };
      mr.ondataavailable = (event) => {
        chunks.push(event.data);
        if (onDataAvailable) {
          onDataAvailable(readableRecorder.read());
          onDataAvailable = undefined;
        }
      };

      mr.start(1000);
      recordingState = "recording";

      const readableRecorder = {
        read() {
          if (done && chunks.length === 0) return Promise.resolve({ done: true });
          if (chunks.length > 0) return Promise.resolve({ value: chunks.shift(), done: false });
          return new Promise((resolve) => {
            onDataAvailable = resolve;
          });
        },
      };

      startUpload(readableRecorder);
    })
    .catch(onError);
}

function reset() {
  upload = null;
  mr = null;
  stream = null;
  recordingState = "inactive";
  recordBtn.textContent = "Start Recording";
  stopBtn.disabled = true;
}

function onError(error) {
  console.error(error);
  alert(`Error: ${error}`);
  reset();
}
