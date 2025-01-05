let timeoutId: NodeJS.Timeout | null = null;

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
          reasons: [chrome.offscreen.Reason.USER_MEDIA],
          justification: "Recording from chrome.tabCapture API",
        });
      }

      const streamId = await new Promise<string>((resolve) => {
        chrome.tabCapture.getMediaStreamId({ targetTabId: tab[0].id }, (streamId) => {
          resolve(streamId);
        });
      });

      chrome.runtime.sendMessage({
        type: "start-recording",
        target: "offscreen",
        streamId,
        apiKey,
        language,
      });
      sendResponse({ success: true, status: "Received start" });
    } else if (message.message === "createRecord") {
      try {
        setTranscript(message.payload.speakers);
        const newRecord = {
          date: message.payload.key,
          title: message.payload.title,
          speakers: message.payload.speakers,
        };
        await createRecord(newRecord);
        sendResponse({ success: true, status: "Received createRecord" });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    } else if (message.message === "updateRecord") {
      try {
        setTranscript(message.payload.speakers);
        const updatingRecord = await readRecord(message.payload.key);
        updatingRecord.speakers.push(...message.payload.speakers);
        await updateRecord(updatingRecord);
        sendResponse({ success: true, status: "Received updateRecord" });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    } else if (message.message === "updateRecordBlob") {
      const transcriptRecord = await readRecord(message.payload.key);
      transcriptRecord.audio = message.payload.audio;
      await updateRecord(transcriptRecord);
      sendResponse({ success: true, status: "Received updateRecordBlob" });
    } else if (message.message === "recordingBackground") {
      if (message.status === true) {
        chrome.storage.local.set({ recording: true });
        if (timeoutId) clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
          chrome.storage.local.set({ recording: false });
          chrome.storage.local.set({ transcript: [] });
        }, 5000);
      }
      sendResponse({ success: true, status: "Received recordingBackground" });
    } else if (message.message === "stop") {
      chrome.storage.local.set({ transcript: [] });
      chrome.runtime.sendMessage({
        type: "stop-recording",
        target: "offscreen",
      });
      sendResponse({ success: true, status: "Received stop" });
    }
  } catch (error) {
    console.error("Error in onMessage listener:", error);
    sendResponse({ success: false, error: error.message });
  }

  return true;
});

function setTranscript(words: any[]): void {
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

async function getApiSettings(): Promise<{ apiKey: string; language: string }> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["key", "language"], (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve({ apiKey: result.key, language: result.language });
    });
  });
}

async function createRecord(record: any): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("transcripts", "readwrite");
    const store = transaction.objectStore("transcripts");

    const request = store.add(record);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (error: any) => {
      reject(`Error adding record: ${error.target.error}`);
    };
  });
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("TranscriptsDB", 3);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("transcripts")) {
        db.createObjectStore("transcripts", { keyPath: "date" });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (error) => {
      reject(`Error opening IndexedDB: ${error}`);
    };
  });
}

async function updateRecord(updatedRecord: any): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("transcripts", "readwrite");
    const store = transaction.objectStore("transcripts");

    const request = store.put(updatedRecord);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (error: any) => {
      reject(`Error updating record: ${error.target.error}`);
    };
  });
}

async function readRecord(key: string): Promise<any> {
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

    request.onerror = (error: any) => {
      reject(`Error reading record: ${error.target.error}`);
    };
  });
}