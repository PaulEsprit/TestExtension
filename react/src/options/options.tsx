import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./options.css";

const Option: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>("");
  const [language, setLanguage] = useState<string>("en");
  const [transcripts, setTranscripts] = useState<any[]>([]);

  useEffect(() => {
    // Load existing settings
    chrome.storage.local.get(["key", "language"], ({ key, language: savedLanguage }) => {
      if (key) setApiKey(key);
      if (savedLanguage) setLanguage(savedLanguage);
    });
    
    renderTable();
  }, []);

  const handleSaveSettings = () => {
    chrome.storage.local.set({ key: apiKey, language }, () => {
      alert("Deepgram API Key and Language Set");
    });
  };

  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("TranscriptsDB", 3);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("transcripts")) {
          db.createObjectStore("transcripts", { keyPath: "date" });
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target.result);
      };

      request.onerror = (error: any) => {
        reject(`Error opening IndexedDB: ${error}`);
      };
    });
  };

  const getAllRecords = async (): Promise<any[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("transcripts", "readonly");
      const store = transaction.objectStore("transcripts");
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (error: any) => {
        reject(`Error fetching all records: ${error.target.error}`);
      };
    });
  };

  const renderTable = async () => {
    const data = await getAllRecords();
    setTranscripts(data);
  };

  const handleDeleteRow = async (date: string) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("transcripts", "readwrite");
      const store = transaction.objectStore("transcripts");
      const request = store.delete(date);

      request.onsuccess = () => {
        renderTable();
        resolve("Record deleted successfully.");
      };

      request.onerror = (error: any) => {
        reject(`Error deleting record: ${error.target.error}`);
      };
    });
  };

  return (
    <div>
      <h1>Provide your Deepgram API Key</h1>

      <input
        type="text"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Enter API Key"
      />

      <h2>Select Language</h2>
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option value="en">English</option>
        <option value="multi">MultiLanguage</option>
        <option value="ru">Russian</option>
        <option value="uk">Ukrainian</option>
      </select>

      <button id="save-settings" onClick={handleSaveSettings}>Save</button>

      <h2>Transcripts</h2>
      <table id="transcripts-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Session Name</th>
            <th>Plain text</th>
            <th>Normalized json</th>
            <th>Row json</th>
            <th>Audio file</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {transcripts.map((transcript, index) => (
            <tr key={index}>
              <td>{transcript.date}</td>
              <td>{transcript.title}</td>
              <td>
                {transcript.speakers && (
                  <button>Download</button>
                )}
              </td>
              <td>
                {transcript.speakers && (
                  <button>Download</button>
                )}
              </td>
              <td>
                {transcript.speakers && (
                  <button>Download</button>
                )}
              </td>
              <td>{transcript.audio}</td>
              <td>
                <button onClick={() => handleDeleteRow(transcript.date)}>
                  Delete Row
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Render the App component
const container = document.createElement("div");
document.body.appendChild(container);
const root = ReactDOM.createRoot(container);
root.render(
<React.StrictMode>
  <Option />
</React.StrictMode>
);