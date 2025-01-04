let socketMic, socketTab, recorder, recorderMic, recorderTab;
let isRecording = false;
let data = [];
let dataMic = [];
let dataTab = [];
let recordKey;
let intervalId = null;
let tabStream = null;

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.target !== "offscreen") return;

  try {
    if (message.type === "start-recording" && !isRecording) {
      await startRecording(message.streamId, message.apiKey, message.language);
      sendResponse({ status: "Recording started" });
    } else if (message.type === "stop-recording" && isRecording) {
      stopRecording();
      sendResponse({ status: "Recording stopped" });
    } else {
      sendResponse({ error: "Invalid message type or state." });
    }
  } catch (error) {
    console.error("Error in onMessage listener:", error);
    sendResponse({ error: error.message });
  }

  return true;
});

function stopRecording() {
  if (socketMic) socketMic.close();
  if (socketTab) socketTab.close();
  if (recorderMic) {
    recorderMic.stop();
    recorderMic = undefined;
    dataMic = [];
  }
  if (recorderTab) {
    recorderTab.stop();
    recorderTab = undefined;
    dataTab = [];
  }
  if (recorder) recorder.stop();

  if (tabStream) {
    stopStream(tabStream);
    tabStream = null;
  }

  isRecording = false; // Reset recording state
  chrome.runtime.sendMessage(
    { message: "recording", payload: isRecording },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error sending 'recording' message:",
          chrome.runtime.lastError.message
        );
      }
    }
  );
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null; // Reset the interval ID
  }
}

async function startRecording(streamId, apiKey, language) {
  try {
    if (!apiKey) {
      alert("You must provide a Deepgram API Key in the options page.");
      isRecording = false;
      return;
    }
    isRecording = true; // Set recording state to true

    chrome.runtime.sendMessage(
      { message: "recording", payload: isRecording },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error sending 'recording' message:",
            chrome.runtime.lastError.message
          );
        }
      }
    );
    intervalId = setInterval(() => {
      chrome.runtime.sendMessage({
        message: "recordingBackground",
        status: true,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error sending 'recordingBackground' message:",
            chrome.runtime.lastError.message
          );
        }
      });
    }, 1000);

    tabStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    if (tabStream.getAudioTracks().length === 0) {
      alert("You must share your tab with audio. Refresh the page.");
      isRecording = false;
      return;
    }

    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    const audioContext = new AudioContext();
    const mixedStream = mix(audioContext, [tabStream, micStream]);

    const audioContextTab = new AudioContext();
    const sourceTabStream = audioContextTab.createMediaStreamSource(tabStream);
    sourceTabStream.connect(audioContextTab.destination);

    recorderTab = new MediaRecorder(tabStream, { mimeType: "audio/webm" });
    recorderMic = new MediaRecorder(micStream, { mimeType: "audio/webm" });
    recorder = new MediaRecorder(mixedStream, { mimeType: "audio/webm" });

    const socketUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=${language}&diarize=true&smart_format=true`;

    socketTab = new WebSocket(socketUrl, ["token", apiKey]);
    socketMic = new WebSocket(socketUrl, ["token", apiKey]);

    recorderMic.addEventListener("dataavailable", (evt) => {
      if (evt.data.size > 0 && socketMic.readyState === 1) {
        socketMic.send(evt.data);
        dataMic.push(evt.data);
      }
    });
    recorderTab.addEventListener("dataavailable", (evt) => {
      if (evt.data.size > 0 && socketTab.readyState === 1) {
        socketTab.send(evt.data);
        dataTab.push(evt.data);
      }
    });
    recorder.addEventListener("dataavailable", (evt) => {
      if (evt.data.size > 0) {
        data.push(evt.data);
      }
    });

    recorder.onstop = async () => {
      const blob = new Blob(data, { type: "audio/webm" });

      const fileName = downloadFileAudio(blob);

      chrome.runtime.sendMessage(
        {
          message: "updateRecordBlob",
          payload: {
            key: recordKey,
            audio: fileName,
          },
        },
        (response) => {}
      );

      recorder = undefined;
      data = [];
      recordKey = undefined;
    };

    socketTab.onopen = () => {
      recorderTab.start(250);
      recorder.start(250);
    };

    socketMic.onopen = () => {
      recorderMic.start(250);
    };

    socketTab.onmessage = async (msg) => {
      const { words } = JSON.parse(msg.data).channel.alternatives[0];
      if (words) {
        words.forEach((word) => {
          word.speaker_name = `Speaker-${word.speaker}`;
        });

        if (!recordKey) {
          sendCreateRecord(words);
        } else {
          updateRecord(words);
        }
      }
    };

    socketMic.onmessage = async (msg) => {
      const { words } = JSON.parse(msg.data).channel.alternatives[0];
      if (words) {
        words.forEach((word) => {
          word.speaker_name = "Me";
        });

        if (!recordKey) {
          sendCreateRecord(words);
        } else {
          updateRecord(words);
        }
      }
    };
  } catch (error) {
    console.error("Error in startRecording:", error);
    isRecording = false;
    chrome.runtime.sendMessage({ message: "recording", payload: isRecording });
  }
}

function sendCreateRecord(words) {
  recordKey = new Date().toISOString();
  var sessionName = `Session-${Date.now()}`;
  chrome.runtime.sendMessage(
    {
      message: "createRecord",
      payload: {
        key: recordKey,
        title: sessionName,
        speakers: words,
      },
    })
    .then(response => {
      if (response && response.success) {
        console.log("Update successful:", response.status);
      } else {
        console.log("Update failed:", response?.error);
      }
    })
    .catch(error => console.error("Error communicating with background script:", error));
}

function updateRecord(words) {
  chrome.runtime.sendMessage(
    {
      message: "updateRecord",
      payload: {
        key: recordKey,
        speakers: words,
      },
    })
    .then(response => {
      if (response && response.success) {
        console.log("Update successful:", response.status);
      } else {
        console.log("Update failed:", response?.error);
      }
    })
    .catch(error => console.error("Error communicating with background script:", error));
}

function downloadFileAudio(blob) {
  var url = URL.createObjectURL(blob);

  const downloadLink = document.createElement("a");

  // Set the anchor's attributes
  downloadLink.href = url;
  const fileName = `recording_${Date.now()}.webm`;
  downloadLink.download = fileName; // Specify the desired filename

  // Programmatically trigger a click event on the anchor to initiate the download
  downloadLink.click();

  return fileName;
}

function downloadFileTranscription(transcript) {
  const encodedTranscript = encodeURIComponent(transcript);
  const url = `data:text/plain;charset=utf-8,${encodedTranscript}`;

  const downloadLink = document.createElement("a");

  // Set the anchor's attributes
  downloadLink.href = url;
  downloadLink.download = `transcript_${Date.now()}.txt`; // Specify the desired filename

  downloadLink.click();
}

// Helper function to mix streams
function mix(audioContext, streams) {
  const dest = audioContext.createMediaStreamDestination();
  streams.forEach((stream) => {
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(dest);
  });
  return dest.stream;
}

function stopStream(stream) {
  if (stream) {
    const tracks = stream.getTracks();
    tracks.forEach((track) => track.stop());
  }
}
