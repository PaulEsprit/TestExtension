let timeoutId = null;

timeoutId = setTimeout(() => {
  chrome.storage.local.set({ recording: false });
  chrome.storage.local.set({ transcript: [] });
}, 5000);

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("welcome.html"),
      active: true,
    });
  }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    if (message.message === "start") {
      const tab = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const existingContexts = await chrome.runtime.getContexts({});
      const offscreenDocument = existingContexts.find(
        (c) => c.contextType === "OFFSCREEN_DOCUMENT"
      );
      chrome.storage.local.set({ transcript: [] });
      const { apiKey, language } = await getApiSettings();

      if (!offscreenDocument) {
        await chrome.offscreen.createDocument({
          url: "offscreen.html",
          reasons: ["USER_MEDIA"],
          justification: "Recording from chrome.tabCapture API",
        });
      }

      const streamId = await chrome.tabCapture.getMediaStreamId({
        targetTabId: tab[0].id,
      });
      chrome.runtime.sendMessage({
        type: "start-recording",
        target: "offscreen",
        streamId,
        apiKey,
        language,
      });
      sendResponse({ status: "Received start" });
    } else if (message.message === "createRecord") {
      setTranscript(message.payload.speakers);
      const newRecord = {
        date: message.payload.key,
        title: message.payload.title,
        speakers: message.payload.speakers,
      };
      await createRecord(newRecord);
      sendResponse({ status: "Received createRecord" });
    } else if (message.message === "updateRecord") {
      setTranscript(message.payload.speakers);
      const updatingRecord = await readRecord(message.payload.key);
      updatingRecord.speakers.push(...message.payload.speakers);
      await updateRecord(updatingRecord).then(console.log).catch(console.error);
      sendResponse({ status: "Received updateRecord" });
    } else if (message.message === "updateRecordBlob") {
      const transcriptRecord = await readRecord(message.payload.key);
      transcriptRecord.audio = message.payload.audio;
      await updateRecord(transcriptRecord)
        .then(console.log)
        .catch(console.error);
      sendResponse({ status: "Received updateRecordBlob" });
    } else if (message.message === "recordingBackground") {
      if (message.status === true) {
        // Set recording state to true
        chrome.storage.local.set({ recording: true });
        // Clear any existing timeout
        if (timeoutId) clearTimeout(timeoutId);

        // Set a timeout to reset the state to false if no messages are received within 2 seconds
        timeoutId = setTimeout(() => {
          chrome.storage.local.set({ recording: false });
          chrome.storage.local.set({ transcript: [] });
        }, 5000);
      }
      sendResponse({ status: "Received recordingBackground" });
    } else if (message.message === "stop") {
      chrome.storage.local.set({ transcript: [] });
      chrome.runtime.sendMessage({
        type: "stop-recording",
        target: "offscreen",
      });
      sendResponse({ status: "Received stop" });
    }
  } catch (error) {
    console.error("Error in onMessage listener:", error);
    sendResponse({ error: error.message });
  }

  return true;
});

function setTranscript(words) {
  chrome.storage.local.get("transcript", (result) => {
    const currentTranscript = result.transcript || [];
    currentTranscript.push(...words);
    chrome.storage.local.set({ transcript: currentTranscript }, () => {
      chrome.runtime
        .sendMessage({ message: "transcriptavailable" })
        .catch(() => {});
    });
  });
}

async function setTranscriptAsync(words) {
  // Get the existing transcript from storage
  const currentTranscript = await new Promise((resolve, reject) => {
      chrome.storage.local.get("transcript", (result) => {
          if (chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError);
          }
          resolve(result.transcript || []);
      });
  });

  // Update the transcript
  const updatedTranscript = [...currentTranscript, ...words];

  // Set the updated transcript in storage
  await new Promise((resolve, reject) => {
      chrome.storage.local.set({ transcript: updatedTranscript }, () => {
          if (chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError);
          }
          resolve();
      });
  });

  // Send a message to notify that the transcript is available
  try {
      await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ message: "transcriptavailable" }, (response) => {
              if (chrome.runtime.lastError) {
                  return reject(chrome.runtime.lastError);
              }
              resolve(response);
          });
      });
  } catch (error) {
      console.error("Error sending 'transcriptavailable' message:", error);
  }
}

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

async function createRecord(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("transcripts", "readwrite");
    const store = transaction.objectStore("transcripts");

    const request = store.add(record);

    request.onsuccess = () => {
      resolve();
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
    const transaction = db.transaction("transcripts", "readwrite");
    const store = transaction.objectStore("transcripts");

    const request = store.put(updatedRecord);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (error) => {
      reject(`Error updating record: ${error.target.error}`);
    };
  });
}

async function readRecord(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("transcripts", "readonly");
    const store = transaction.objectStore("transcripts");

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

async function getApiSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["key", "language"], (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve({ apiKey: result.key, language: result.language });
    });
  });
}
