import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./popup.css";

const Popup: React.FC = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");

  useEffect(() => {
    updateRecordingState();
    showLatestTranscript();

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        if (message.message === "transcriptavailable") {
          showLatestTranscript();
          sendResponse({ status: "Received transcriptavailable" });
        } else if (message.message === "recording") {
          const recordingStatus = message.payload as boolean;
          setIsRecording(recordingStatus);
          chrome.storage.local.set({ recording: recordingStatus });
          console.error('recordingStatus', recordingStatus);
          sendResponse({ status: "Received recording" });
        }
      } catch (error) {
        console.error("Error in onMessage listener:", error);
        sendResponse({ error: error.message });
      }

      return true;
    });
  }, []);

  const updateRecordingState = (): void => {
    chrome.storage.local.get("recording", ({ recording }) => {
      setIsRecording(recording || false);
    });
  };

  const showLatestTranscript = (): void => {
    chrome.storage.local.get("transcript", ({ transcript }) => {
      if (transcript) {
        setTranscript(createPlainText(transcript));
      } else {
        setTranscript("");
      }
    });
  };

  const handleStart = (): void => {
    chrome.runtime.sendMessage({ message: "start" });
  };

  const handleStop = (): void => {
    chrome.runtime.sendMessage({ message: "stop" });
  };

  const handleClear = (): void => {
    chrome.storage.local.set({ transcript: [] });
    setTranscript("");
  };

  const handleOptions = (): void => {
    chrome.runtime.openOptionsPage();
  };

  const createPlainText = (words: Array<{ speaker_name: string; punctuated_word: string }>): string => {
    if (!words || words.length === 0) return "";

    let plainText = "";
    let currentSentence = "";
    let currentSpeakerName = words[0]?.speaker_name;

    words.forEach((word, index) => {
      if (word.speaker_name !== currentSpeakerName) {
        if (currentSentence) {
          plainText += `[${currentSpeakerName}] ${currentSentence.trim()}\n`;
        }
        currentSpeakerName = word.speaker_name;
        currentSentence = "";
      }

      currentSentence += word.punctuated_word + " ";

      if (index === words.length - 1) {
        plainText += `[${currentSpeakerName}] ${currentSentence.trim()}\n`;
      }
    });

    return plainText;
  };

  return (
    <div>
      <div id="header">
        <button id="options" onClick={handleOptions}>
          Options
        </button>
        {isRecording && <p id="recording">Recording...</p>}
      </div>
      <div id="controls">
        <button id="start" onClick={handleStart} disabled={isRecording}>
          Start
        </button>
        <button id="stop" onClick={handleStop} disabled={!isRecording}>
          Stop
        </button>
        <button id="clear" onClick={handleClear}>
          Clear
        </button>
      </div>
      <p id="transcript">
        {transcript}
      </p>
    </div>
  );
};

const container = document.createElement("div");
document.body.appendChild(container);
const root = ReactDOM.createRoot(container);
root.render(
<React.StrictMode>
  <Popup />
</React.StrictMode>
);