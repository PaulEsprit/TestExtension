chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.message === 'start') {
      const streamId = await new Promise((resolve) => {
        chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId }, (streamId) => {
                resolve(streamId);
            });
        });
        console.error('BACKGROUND StreamId', streamId);
        chrome.tabs.create({ url: 'https://deepgram.com' }, async (newTab) => {
          // await chrome.scripting.executeScript({
          //   target: { tabId: newTab.id },
          //   files: ["content-script.js"]
          // });

          async function sendMessageAfterTimeout() {
            try {
              await new Promise(resolve => setTimeout(resolve, 5000));
              await chrome.tabs.sendMessage(newTab.id, { message: 'start', streamId });
              console.error('Message sent to content script in new tab.');
            } catch (error) {
              console.error('Error sending message to content script:', error);
            }
          }
        
          await sendMessageAfterTimeout();
        });
    }
    else if (message.message === 'createRecord') {
      await createRecord(message.payload);
    } else if (message.message === 'updateRecord') {
      const updatingRecord = await readRecord(message.payload.key);
      updatingRecord.onlineTranscript = (updatingRecord.onlineTranscript  || "") + " " + message.payload.transcript;
      await updateRecord(updatingRecord).then(console.log).catch(console.error);
    } else if (message.message === 'updateRecordApi') {
      const transcriptRecord = await readRecord(message.payload.key);
      transcriptRecord.transcript = message.payload.transcript;
      transcriptRecord.audio = message.payload.audio;
      await updateRecord(transcriptRecord).then(console.error).catch(console.error);
    }
  });


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

async function createRecord(record) {
    debugger
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('transcripts', 'readwrite');
        const store = transaction.objectStore('transcripts');

        const request = store.add(record);

        request.onsuccess = () => {
            resolve('Record added successfully.');
        };

        request.onerror = (error) => {
            reject(`Error adding record: ${error.target.error}`);
        };
    });
}

// Update a record by key
async function updateRecord(updatedRecord) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('transcripts', 'readwrite');
        const store = transaction.objectStore('transcripts');

        const request = store.put(updatedRecord);

        request.onsuccess = () => {
            resolve('Record updated successfully.');
        };

        request.onerror = (error) => {
            reject(`Error updating record: ${error.target.error}`);
        };
    });
}

async function readRecord(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('transcripts', 'readonly');
        const store = transaction.objectStore('transcripts');

        const request = store.get(key);

        request.onsuccess = () => {
            if (request.result) {
                resolve(request.result);
            } else {
                reject(`No record found with key: ${key}`);
            }
        };

        request.onerror = (error) => {
            reject(`Error reading record: ${error.target.error}`);
        };
    });
}

