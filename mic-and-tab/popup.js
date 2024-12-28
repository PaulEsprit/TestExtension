isRecording = false;

showLatestTranscript();

updateRecordingElement();

document.getElementById("start").addEventListener("click", async () => {
  //const tab = await getCurrentTab();
  //if (!tab) return alert("Require an active tab");
  chrome.runtime.sendMessage({ message: "start"  });
});

document.getElementById("stop").addEventListener("click", async () => {
  chrome.runtime.sendMessage({ message: "stop"  });
});

document.getElementById("clear").addEventListener("click", async () => {
  chrome.storage.local.set({ transcript: [] });
  document.getElementById("transcript").innerHTML = "";
});

document.getElementById("options").addEventListener("click", async () => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.message == "transcriptavailable") {
      showLatestTranscript();
      sendResponse({ status: "Received transcriptavailable" });
    } else if (message.message == "recording") {
      isRecording = message.payload;
      chrome.storage.local.set({ recording: isRecording });
      displayRecording();
      sendResponse({ status: "Received recording" });
    }
  } catch (error) {
    console.error("Error in onMessage listener:", error);
    sendResponse({ error: error.message });
  }

  return true;
});

function showLatestTranscript() {
  chrome.storage.local.get("transcript", ({ transcript }) => {
    if (!transcript) return;
    const plainText = createPlainText(transcript);
    document.getElementById("transcript").innerHTML =
    plainText === undefined ? "" : plainText;
  });
}

async function getCurrentTab() {
  const queryOptions = { active: true, lastFocusedWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

function updateRecordingElement() {
  chrome.storage.local.get("recording", ({ recording }) => {
      isRecording = recording;
      displayRecording();
  });  
}

function displayRecording() {
  const recordingElement = document.getElementById("recording");
  const startButton = document.getElementById("start");
  const stopButton = document.getElementById("stop");
  startButton.disabled = isRecording;
  stopButton.disabled = !isRecording;
  if (isRecording) {
    recordingElement.style.display = "block"; // Show the element
  } else {
    recordingElement.style.display = "none"; // Hide the element
  }
}

function createPlainText(words) {
  if (words.length === 0) return "";
  
  let plainText = "";
  let currentSentence = "";

  let currentSpeakerName = words[0]?.speaker_name; // Start with the first word's speakerName

  words.forEach((word, index) => {
    if (word.speaker_name !== currentSpeakerName) {
      // If the speaker changes, save the current sentence
      if (currentSentence) {
        plainText = `${plainText} [${currentSpeakerName}] ${currentSentence.trim()}`;
      }

      currentSpeakerName = word.speaker_name;
      currentSentence = ""; // Reset sentence
    }

    // Build the current sentence
    currentSentence += word.punctuated_word + " ";

    // Handle the last word explicitly
    if (index === words.length - 1) {
      plainText = `${plainText} [${currentSpeakerName}] ${currentSentence.trim()}`;
    }
  });

  return plainText;
}
