let downloadFilePath;

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.message === "start") {
    const streamId = "streamId";
    try {
      await chrome.tabs.sendMessage(message.tabId, {
        message: "start",
        streamId,
      });
    } catch (e) {
      chrome.tabs.reload(message.tabId);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await chrome.tabs.sendMessage(message.tabId, {
        message: "start",
        streamId,
      });
    }
  } else if (message.message === "createRecord") {
    const newRecord = {
      date: message.payload.key,
      title: message.payload.title,
      transcript: message.payload.transcript,
      speakers: message.payload.speakers,
      audio: null,
    };
    await createRecord(newRecord);
  } else if (message.message === "updateRecord") {
    const updatingRecord = await readRecord(message.payload.key);
    updatingRecord.transcript =
      (updatingRecord.transcript || "") + " " + message.payload.transcript;
    updatingRecord.speakers.push(...message.payload.speakers);
    await updateRecord(updatingRecord).then(console.log).catch(console.error);
  } else if (message.message === "updateRecordBlob") {
    const transcriptRecord = await readRecord(message.payload.key);
    transcriptRecord.audio = message.payload.audio;
    await updateRecord(transcriptRecord)
      .then(console.error)
      .catch(console.error);
  }
});

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
      resolve("Record added successfully.");
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
      resolve("Record updated successfully.");
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
