const socket = io();

// DOM elements
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const pinInput = document.getElementById("pinInput");
const nicknameInput = document.getElementById("nickname");
const fileList = document.getElementById("fileList");

// --- Drag & Drop Zone ---
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length > 0) {
    handleUpload(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener("change", e => {
  if (e.target.files.length > 0) {
    handleUpload(e.target.files[0]);
  }
});

// --- Upload Function ---
async function handleUpload(file) {
  const pin = pinInput.value.trim();
  const nickname = nicknameInput.value.trim();

  if (!file || !pin) {
    alert("Create PIN");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("pin", pin);
  formData.append("nickname", nickname);

  const res = await fetch("/upload", { method: "POST", body: formData });
  const data = await res.json();
  if (!data.success) {
    alert("Upload failed");
  }
}

// --- Escape HTML (for safe rendering) ---
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function renderFiles(files) {
  fileList.innerHTML = "";
  files.forEach((f, idx) => {
    const stored = f.stored;
    const nameEnc = encodeURIComponent(f.name);
    const nicknamePart = f.nickname ? ` (By ${escapeHtml(f.nickname)})` : "";

    const li = document.createElement("li");
    li.className = "file-item";
    li.innerHTML = `
      <span>
        <b>${escapeHtml(f.name)}</b> (${(f.size/1024).toFixed(1)} KB)${nicknamePart}
      </span>
      <span>
        <button onclick="showInfo(${idx})">Info</button>
        <button onclick="downloadFile('${stored}', '${nameEnc}')">Download</button>
        <button onclick="deleteFile('${stored}')">Delete</button>
      </span>
    `;
    fileList.appendChild(li);
  });

  // Save latest files globally so info popup can use them
  window.latestFiles = files;
}

// --- Real-time updates from server ---
socket.on("update", files => {
  renderFiles(files);
});

// --- Download with PIN ---
async function downloadFile(stored, originalNameEncoded) {
  const originalName = decodeURIComponent(originalNameEncoded);
  const pin = prompt("Enter PIN to download:");
  if (!pin) return;

  try {
    const res = await fetch("/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: stored, pin })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      alert(err.error || "Download failed");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = originalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert("Download error");
  }
}

// --- Delete with PIN ---
async function deleteFile(stored) {
  const pin = prompt("Enter PIN to delete:");
  if (!pin) return;

  const res = await fetch("/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: stored, pin })
  });

  const data = await res.json();
  if (!data.success) alert(data.error || "Delete failed");
}


// Show file info modal
function showInfo(index) {
  const f = window.latestFiles[index];
  const details = document.getElementById("infoDetails");
  details.innerHTML = `
    <li><b>Name:</b> ${escapeHtml(f.name)}</li>
    <li><b>Size:</b> ${(f.size/1024).toFixed(2)} KB</li>
    <li><b>Device:</b> ${escapeHtml(f.device)}</li>
    <li><b>Nickname:</b> ${escapeHtml(f.nickname || "—")}</li>
    <li><b>Time:</b> ${new Date(f.time).toLocaleString()}</li>
  `;

  document.getElementById("infoModal").style.display = "block";
}

// Modal close logic
document.getElementById("closeModal").onclick = () => {
  document.getElementById("infoModal").style.display = "none";
};
window.onclick = e => {
  if (e.target === document.getElementById("infoModal")) {
    document.getElementById("infoModal").style.display = "none";
  }
};
