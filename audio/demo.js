const userIdInput = document.getElementById("user-id");

// Start 녹음
startBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm; codecs=opus" });
  mediaRecorder.start(1000);

  startBtn.disabled = true;
  stopBtn.disabled = false;

  uploadUrl = null; // 항상 새 세션
  localStorage.removeItem("uploadUrl");

  mediaRecorder.ondataavailable = (e) => {
    const blob = new Blob([e.data], { type: "audio/webm; codecs=opus" });
    if (!uploadUrl) {
      initiateUploadSession(blob);
    } else {
      uploadQueue = uploadQueue.then(() => patchChunk(blob));
    }
  };
};

// POST로 업로드 시작 (userId 포함)
function initiateUploadSession(blob) {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", endpointInput.value, true);
  xhr.setRequestHeader("Tus-Resumable", "1.0.0");

  const counselSessionId = btoa(userIdInput.value || "anonymous");
  const filename = btoa(`recording_${Date.now()}.webm`);
  xhr.setRequestHeader("Upload-Metadata", `filename ${filename},counselSessionId ${counselSessionId}`);
  xhr.setRequestHeader("Upload-Defer-Length", "1");

  xhr.onload = async () => {
    if (xhr.status === 201) {
      uploadUrl = xhr.getResponseHeader("Location");
      if (!uploadUrl.startsWith("http")) {
        const origin = new URL(endpointInput.value).origin;
        uploadUrl = origin + uploadUrl;
      }
      localStorage.setItem("uploadUrl", uploadUrl);
      currentOffset = 0;
      uploadLink.innerHTML = `<a href="${uploadUrl}" target="_blank">${uploadUrl}</a>`;
      await patchChunk(blob);
    }
  };
  xhr.send(null);
}

// Stop 녹음
stopBtn.onclick = () => {
  mediaRecorder.stop();
  uploadUrl = null;
  localStorage.removeItem("uploadUrl");
  startBtn.disabled = false;
  stopBtn.disabled = true;
};

// Merge
const mergeBtn = document.getElementById("merge-record");

mergeBtn.onclick = async () => {
  const counselSessionId = userIdInput.value;
  if (!counselSessionId) {
    alert("Please enter your user ID first.");
    return;
  }

  const response = await fetch(`http://localhost:8080/merge?counselSessionId=${encodeURIComponent(counselSessionId)}`);
  const result = await response.json();
  if (response.ok) {
    alert("Merged file available at: " + result.url);
    uploadLink.innerHTML = `<a href="${result.url}" target="_blank">${result.url}</a>`;
  } else {
    alert("Merge failed: " + result.error);
  }
};
