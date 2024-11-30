const api = document.getElementById('api')
const language = document.getElementById('language')
const button = document.querySelector('button')
let transcriptData = [
  {
    sessionName: "Session 1",
    onlineTranscriptDate: "2024-11-01",
    transcriptDate: "2024-11-02",
  },
  {
    sessionName: "Session 2",
    onlineTranscriptDate: "2024-11-03",
    transcriptDate: "2024-11-04",
  },
];


chrome.storage.local.get(['key', 'language'], ({ key, language: savedLanguage }) => {
  if (key) api.value = key;
  if (savedLanguage) language.value = savedLanguage;
});

document.querySelectorAll(".button-save").forEach((button) => {
  button.addEventListener("click", saveOptions);
});

function saveOptions() {
  const key = api.value;
  const selectedLanguage = language.value;

  chrome.storage.local.set({ key, language: selectedLanguage }, () => {
    alert('Deepgram API Key and Language Set');
  });
}

// Function to render the table
function renderTable() {
  const tableBody = document.querySelector("#transcripts-table tbody");
  tableBody.innerHTML = ""; // Clear the table body

  transcriptData.forEach((data, index) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${data.sessionName}</td>
      <td>${data.onlineTranscriptDate}</td>
      <td>${data.transcriptDate}</td>
      <td>
        <button class="download-online" data-index="${index}">Download Online Transcript</button>
        <button class="delete-online" data-index="${index}">Delete Online Transcript</button>
        <button class="download" data-index="${index}">Download Transcript</button>
        <button class="delete" data-index="${index}">Delete Transcript</button>
      </td>
    `;

    tableBody.appendChild(row);
  });

  // Add event listeners for buttons
  document.querySelectorAll(".download-online").forEach((button) => {
    button.addEventListener("click", downloadOnlineTranscript);
  });

  document.querySelectorAll(".delete-online").forEach((button) => {
    button.addEventListener("click", deleteOnlineTranscript);
  });

  document.querySelectorAll(".download").forEach((button) => {
    button.addEventListener("click", downloadTranscript);
  });

  document.querySelectorAll(".delete").forEach((button) => {
    button.addEventListener("click", deleteTranscript);
  });
}

// Button click handlers
function downloadOnlineTranscript(event) {
  const index = event.target.dataset.index;
  alert(`Downloading online transcript for: ${transcriptData[index].sessionName}`);
}

function deleteOnlineTranscript(event) {
  const index = event.target.dataset.index;
  transcriptData[index].onlineTranscriptDate = null;
  alert(`Deleted online transcript for: ${transcriptData[index].sessionName}`);
  renderTable(); // Re-render table after updating data
}

function downloadTranscript(event) {
  const index = event.target.dataset.index;
  alert(`Downloading transcript for: ${transcriptData[index].sessionName}`);
}

function deleteTranscript(event) {
  const index = event.target.dataset.index;
  transcriptData.splice(index, 1); // Remove item from array
  alert(`Deleted transcript for: ${transcriptData[index]?.sessionName || "Unknown"}`);
  renderTable(); // Re-render table after deletion
}

// Initial render
renderTable();
