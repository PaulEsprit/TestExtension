import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

const OffScreen: React.FC = () => {
  const [recordKey, setRecordKey] = useState<string>(null);
  const [timerInterval, setTimerInterval] = useState<any>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [tabStream, setTabStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [data, setData] = useState<Blob[]>([]);
  const [dataMic, setDataMic] = useState<Blob[]>([]);
  const [dataTab, setDataTab] = useState<Blob[]>([]);
  const [socketMicState, setSocketMic] = useState<WebSocket | null>(null);
  const [socketTabState, setSocketTab] = useState<WebSocket | null>(null);


  function mix(audioContext: AudioContext, streams: MediaStream[]): MediaStream {
    const dest = audioContext.createMediaStreamDestination();
    streams.forEach((stream) => {
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(dest);
    });
    return dest.stream;
  }

  function sendCreateRecord(words:any[]): void {
    setRecordKey(new Date().toISOString());
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
  
  function updateRecord(words:any[]): void {
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

  function downloadFileAudio(blob:Blob) : string {
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

  useEffect(() => {
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
  }, [isRecording]);

  const startRecording = async (streamId: string, apiKey: string, language: string) => {
    try {
      if (!apiKey) {
        alert("You must provide a Deepgram API Key in the options page.");
        setIsRecording(false);
        return;
      }

      setIsRecording(true);

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
      const intervalId = setInterval(() => {
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

      setTimerInterval(intervalId);

      const tabStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: streamId,
          },
        },
        video: false,
      } as any);

      if (tabStream.getAudioTracks().length === 0) {
        alert("You must share your tab with audio. Refresh the page.");
        setIsRecording(false);
        return;
      }

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      setTabStream(tabStream);
      setMicStream(micStream);


      const audioContext = new AudioContext();
      const mixedStream = mix(audioContext, [tabStream, micStream]);
  
      const audioContextTab = new AudioContext();
      const sourceTabStream = audioContextTab.createMediaStreamSource(tabStream);
      sourceTabStream.connect(audioContextTab.destination);

      let recorderTab = new MediaRecorder(tabStream, { mimeType: "audio/webm" });
      let recorderMic = new MediaRecorder(micStream, { mimeType: "audio/webm" });
      let recorder = new MediaRecorder(mixedStream, { mimeType: "audio/webm" });

      const socketUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=${language}&diarize=true&smart_format=true`;

      const socketTab = new WebSocket(socketUrl, ["token", apiKey]);
      const socketMic = new WebSocket(socketUrl, ["token", apiKey]);

      setSocketTab(socketTab);
      setSocketMic(socketMic);      

      recorderTab.ondataavailable = (event) => {
        if (event.data.size > 0 && socketTab.readyState === WebSocket.OPEN) {
          socketTab.send(event.data);
          setDataTab((prevData) => [...prevData, event.data]);
        }
      };

      recorderMic.ondataavailable = (event) => {
        if (event.data.size > 0 && socketMic.readyState === WebSocket.OPEN) {
          socketMic.send(event.data);
          setDataMic((prevData) => [...prevData, event.data]);
        }
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setData((prevData) => [...prevData, event.data]);
        }
      };

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
        setData([]);
        setRecordKey(null);
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
      console.error("Error starting recording:", error);
      setIsRecording(false);
    }
  };


  const stopRecording = () => {
    if (socketMicState) {
        socketMicState.close();
      setSocketMic(null);
    }

    if (socketTabState) {
        socketTabState.close();
      setSocketTab(null);
    }

    if (tabStream) {
      tabStream.getTracks().forEach((track) => track.stop());
      setTabStream(null);
    }

    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      setMicStream(null);
    }

    setIsRecording(false);
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
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null); // Reset the interval ID
      }
  };

  return (
    <div>
      <h1>Audio Recorder</h1>
      <p>Status: {isRecording ? "Recording..." : "Idle"}</p>
    </div>
  );
};

// Render the App component
const container = document.createElement("div");
document.body.appendChild(container);
const root = ReactDOM.createRoot(container);
root.render(<OffScreen />);
