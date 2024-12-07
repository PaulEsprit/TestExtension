
    const api = document.getElementById('api');
    const language = document.getElementById('language');
    const saveButton = document.getElementById('save-settings');
    let transcriptData = [];

    // Load existing settings
    chrome.storage.local.get(['key', 'language'], ({ key, language: savedLanguage }) => {
        if (key) api.value = key;
        if (savedLanguage) language.value = savedLanguage;
    });

    // Add event listener to save button
    saveButton.addEventListener('click', () => {
        const key = api.value;
        const selectedLanguage = language.value;

        chrome.storage.local.set({ key, language: selectedLanguage }, () => {
            alert('Deepgram API Key and Language Set');
        });
    });

    renderTable();



// async function displaySavedTranscripts(transcriptsContainer) {
//     const transcripts = await getAllTranscriptsFromIndexedDB();

//     if (transcripts.length === 0) {
//         transcriptsContainer.innerHTML = '<p>No transcripts saved yet.</p>';
//         return;
//     }

//     transcriptsContainer.innerHTML = ''; // Clear the container

//     transcripts.forEach(({ date, data }) => {
//         const transcriptDiv = document.createElement('div');
//         transcriptDiv.style.border = '1px solid #ddd';
//         transcriptDiv.style.margin = '1em 0';
//         transcriptDiv.style.padding = '1em';
//         transcriptDiv.style.backgroundColor = '#f9f9f9';

//         const dateElem = document.createElement('h3');
//         dateElem.textContent = `Date: ${new Date(date).toLocaleString()}`;
//         transcriptDiv.appendChild(dateElem);

//         const transcriptElem = document.createElement('pre');
//         transcriptElem.textContent = JSON.stringify(data, null, 2);
//         transcriptDiv.appendChild(transcriptElem);

//         transcriptsContainer.appendChild(transcriptDiv);
//     });
// }

// // Helper function to get all transcripts from IndexedDB
// async function getAllTranscriptsFromIndexedDB() {
//     return new Promise((resolve, reject) => {
//         const request = indexedDB.open('TranscriptsDB', 2); // Match version

//         request.onsuccess = (event) => {
//             const db = event.target.result;
//             const transaction = db.transaction('transcripts', 'readonly');
//             const store = transaction.objectStore('transcripts');

//             const getAllRequest = store.getAll();

//             getAllRequest.onsuccess = (event) => {
//                 resolve(event.target.result);
//             };

//             getAllRequest.onerror = (error) => {
//                 console.error('Error fetching transcripts:', error);
//                 reject(error);
//             };
//         };

//         request.onerror = (error) => {
//             console.error('Error opening IndexedDB:', error);
//             reject(error);
//         };
//     });
// }


function openDB() {
  return new Promise((resolve, reject) => {
      const request = indexedDB.open('TranscriptsDB', 3);

      request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('transcripts')) {
              db.createObjectStore('transcripts', { keyPath: 'date' });
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
      const transaction = db.transaction('transcripts', 'readwrite');
      const store = transaction.objectStore('transcripts');

      const request = store.delete(key);

      request.onsuccess = () => {
          resolve('Record deleted successfully.');
      };

      request.onerror = (error) => {
          reject(`Error deleting record: ${error.target.error}`);
      };
  });
}


// Get all records
async function getAllRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
      const transaction = db.transaction('transcripts', 'readonly');
      const store = transaction.objectStore('transcripts');

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
      <td>${data.onlineTranscript ? `<button class="download-online" data-index="${index}">Download Online Transcript</button>` : "None"}</td>
      <td>${data.transcript ? `<button class="download-transcript" data-index="${index}">Download Transcript</button>` : "None"}</td>      
      <td>${data.audio}</td>
      <td>       
        <button class="delete" data-index="${index}">Delete Row</button>
      </td>
    `;

    tableBody.appendChild(row);
  });

  // Add event listeners for buttons
  document.querySelectorAll(".download-online").forEach((button) => {
    button.addEventListener("click", downloadOnlineTranscript);
  });

  document.querySelectorAll(".download-transcript").forEach((button) => {
    button.addEventListener("click", downloadTranscript);
  });

  document.querySelectorAll(".delete").forEach((button) => {
    button.addEventListener("click", deleteRow);
  });
}

// Button click handlers
function downloadOnlineTranscript(event) {
  const index = event.target.dataset.index;
  downloadFileTranscription(transcriptData[index].onlineTranscript)
}

function downloadTranscript(event) {
  const index = event.target.dataset.index;  
  downloadFileTranscription(JSON.stringify(transcriptData[index].transcript))
}

function deleteRow(event) {
  const index = event.target.dataset.index;
  const userConfirmed = confirm("Are you sure you want to delete?");
  if (userConfirmed) {
    deleteRecord(transcriptData[index]?.date)
    renderTable(); // Re-render table after deletion
  }   
}

function downloadFileTranscription(transcript) {
  const encodedTranscript = encodeURIComponent(transcript);
  const url = `data:text/plain;charset=utf-8,${encodedTranscript}`;

  const downloadLink = document.createElement('a');

  // Set the anchor's attributes
  downloadLink.href = url;
  downloadLink.download = `transcript_${Date.now()}.txt`; // Specify the desired filename

  // Programmatically trigger a click event on the anchor to initiate the download
  downloadLink.click();    
}



