const api = document.getElementById("api");
const language = document.getElementById("language");
const saveButton = document.getElementById("save-settings");
let transcriptData = [];

// Load existing settings
chrome.storage.local.get(
  ["key", "language"],
  ({ key, language: savedLanguage }) => {
    if (key) api.value = key;
    if (savedLanguage) language.value = savedLanguage;
  }
);

// Add event listener to save button
saveButton.addEventListener("click", () => {
  const key = api.value;
  const selectedLanguage = language.value;

  chrome.storage.local.set({ key, language: selectedLanguage }, () => {
    alert("Deepgram API Key and Language Set");
  });
});

renderTable();

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("TranscriptsDB", 3);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("transcripts")) {
        db.createObjectStore("transcripts", { keyPath: "date" });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (error) => {
      reject(`Error opening IndexedDB: ${error}`);
    };
  });
}

// Delete a record by key
async function deleteRecord(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("transcripts", "readwrite");
    const store = transaction.objectStore("transcripts");

    const request = store.delete(key);

    request.onsuccess = () => {
      resolve("Record deleted successfully.");
    };

    request.onerror = (error) => {
      reject(`Error deleting record: ${error.target.error}`);
    };
  });
}

async function updateRecord(updatedRecord) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("transcripts", "readwrite");
    const store = transaction.objectStore("transcripts");

    const request = store.put(updatedRecord);

    request.onsuccess = () => {
      resolve("Record updated successfully.");
    };

    request.onerror = (error) => {
      reject(`Error updating record: ${error.target.error}`);
    };
  });
}

// Get all records
async function getAllRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("transcripts", "readonly");
    const store = transaction.objectStore("transcripts");

    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = (error) => {
      reject(`Error fetching all records: ${error.target.error}`);
    };
  });
}

// Function to render the table
async function renderTable() {
  const tableBody = document.querySelector("#transcripts-table tbody");
  tableBody.innerHTML = ""; // Clear the table body

  transcriptData = await getAllRecords();

  console.log(transcriptData);

  transcriptData.forEach((data, index) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${data.date}</td>
      <td>
        <span class="session-name" data-index="${index}">${data.title}</span>
        <button class="edit-session-name" data-index="${index}">Edit</button>
      </td>
      <td>${
        data.transcript
          ? `<button class="download-transcript" data-index="${index}">Download</button>`
          : "None"
      }</td>
      <td>${
        data.speakers
          ? `<button class="download-normalized" data-index="${index}">Download</button>`
          : "None"
      }</td>    
      <td>${
        data.speakers
          ? `<button class="download-row" data-index="${index}">Download</button>`
          : "None"
      }</td>          
      <td>${data.audio}</td>
      <td>       
        <button class="delete" data-index="${index}">Delete Row</button>
      </td>
    `;

    tableBody.appendChild(row);
  });

  // Add event listeners for buttons
  document.querySelectorAll(".download-row").forEach((button) => {
    button.addEventListener("click", downloadRowJson);
  });

  document.querySelectorAll(".download-normalized").forEach((button) => {
    button.addEventListener("click", downloadNormilizedJson);
  });

  document.querySelectorAll(".download-transcript").forEach((button) => {
    button.addEventListener("click", downloadTranscript);
  });

  document.querySelectorAll(".delete").forEach((button) => {
    button.addEventListener("click", deleteRow);
  });

  document.querySelectorAll(".edit-session-name").forEach((button) => {
    button.addEventListener("click", enableInlineEditing);
  });
}

function downloadRowJson(event) {
  const index = event.target.dataset.index;
  const rowJson = JSON.stringify(transcriptData[index].speakers,2,2);
  downloadFileTranscription(rowJson, "row");
}

function downloadNormilizedJson(event) {
  const index = event.target.dataset.index;
  const normalizedJson = JSON.stringify(
    createNormalizedJson(transcriptData[index].speakers),
    2,
    2
  );
  downloadFileTranscription(normalizedJson, "normalized");
}

function downloadTranscript(event) {
  const index = event.target.dataset.index;
  downloadFileTranscription(transcriptData[index].transcript, "transcript");
}

function deleteRow(event) {
  const index = event.target.dataset.index;
  const userConfirmed = confirm("Are you sure you want to delete?");
  if (userConfirmed) {
    deleteRecord(transcriptData[index]?.date);
    renderTable(); // Re-render table after deletion
  }
}

function downloadFileTranscription(transcript, fileName) {
  const encodedTranscript = encodeURIComponent(transcript);
  const url = `data:text/plain;charset=utf-8,${encodedTranscript}`;

  const downloadLink = document.createElement("a");

  // Set the anchor's attributes
  downloadLink.href = url;
  downloadLink.download = `${fileName}_${Date.now()}.txt`; // Specify the desired filename

  // Programmatically trigger a click event on the anchor to initiate the download
  downloadLink.click();
}

function enableInlineEditing(event) {
  const index = event.target.dataset.index;
  const sessionNameCell = document.querySelector(
    `.session-name[data-index="${index}"]`
  );
  const oldValue = sessionNameCell.textContent;

  const input = document.createElement("input");
  input.type = "text";
  input.value = oldValue;

  const saveButton = document.createElement("button");
  saveButton.textContent = "Save";
  saveButton.className = "save-session-name";
  saveButton.addEventListener("click", () =>
    saveInlineEdit(index, input.value)
  );

  sessionNameCell.innerHTML = "";
  sessionNameCell.appendChild(input);
  sessionNameCell.appendChild(saveButton);
}

function saveInlineEdit(index, newValue) {
  transcriptData[index].title = newValue;

  // Update IndexedDB
  updateRecord(transcriptData[index]);

  renderTable(); // Re-render the table
}

function createNormalizedJson(words) {
  const normalizedJson = [];

  let currentSentence = "";
  let currentStart = 0;
  let currentSpeakerName = words[0]?.speaker_name; // Start with the first word's speakerName

  words.forEach((word, index) => {
    if (word.speaker_name !== currentSpeakerName) {
      // If the speaker changes, save the current sentence
      if (currentSentence) {
        normalizedJson.push({
          sentence: currentSentence.trim(),
          start: currentStart,
          speaker_name: currentSpeakerName,
        });
      }

      currentSpeakerName = word.speaker_name;
      currentSentence = ""; // Reset sentence
      currentStart = word.start; // Set new start time
    }

    // Build the current sentence
    currentSentence += word.punctuated_word + " ";

    // Handle the last word explicitly
    if (index === words.length - 1) {
      normalizedJson.push({
        sentence: currentSentence.trim(),
        start: currentStart,
        speaker_name: currentSpeakerName,
      });
    }
  });

  return normalizedJson;
}
