document.addEventListener('DOMContentLoaded', () => {
    const api = document.getElementById('api');
    const language = document.getElementById('language');
    const saveButton = document.getElementById('save-settings');

    if (!saveButton) {
        console.error('Save button not found in the DOM!');
        return;
    }

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
});


async function displaySavedTranscripts(transcriptsContainer) {
    const transcripts = await getAllTranscriptsFromIndexedDB();

    if (transcripts.length === 0) {
        transcriptsContainer.innerHTML = '<p>No transcripts saved yet.</p>';
        return;
    }

    transcriptsContainer.innerHTML = ''; // Clear the container

    transcripts.forEach(({ date, data }) => {
        const transcriptDiv = document.createElement('div');
        transcriptDiv.style.border = '1px solid #ddd';
        transcriptDiv.style.margin = '1em 0';
        transcriptDiv.style.padding = '1em';
        transcriptDiv.style.backgroundColor = '#f9f9f9';

        const dateElem = document.createElement('h3');
        dateElem.textContent = `Date: ${new Date(date).toLocaleString()}`;
        transcriptDiv.appendChild(dateElem);

        const transcriptElem = document.createElement('pre');
        transcriptElem.textContent = JSON.stringify(data, null, 2);
        transcriptDiv.appendChild(transcriptElem);

        transcriptsContainer.appendChild(transcriptDiv);
    });
}

// Helper function to get all transcripts from IndexedDB
async function getAllTranscriptsFromIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('TranscriptsDB', 2); // Match version

        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction('transcripts', 'readonly');
            const store = transaction.objectStore('transcripts');

            const getAllRequest = store.getAll();

            getAllRequest.onsuccess = (event) => {
                resolve(event.target.result);
            };

            getAllRequest.onerror = (error) => {
                console.error('Error fetching transcripts:', error);
                reject(error);
            };
        };

        request.onerror = (error) => {
            console.error('Error opening IndexedDB:', error);
            reject(error);
        };
    });
}
