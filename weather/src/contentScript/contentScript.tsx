import * as React from "react";
import * as ReactDOM from "react-dom/client";
import WeatherCard from "../components/WeatherCard";
import { Card, Paper, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { Rnd } from "react-rnd";
import './contentScript.css'

const App: React.FC = () => {
    
    const [isVisible, setIsVisible] = React.useState(true);

    // Listen for messages from the popup script to toggle visibility
    React.useEffect(() => {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === "toggleWeatherWidget") {
                setIsVisible((prev) => !prev);
            }
        });
    }, []);

    if (!isVisible) return null; // Do not render if hidden
    
    return (
        <Rnd
            default={{
                x: 100,
                y: 100,
                width: 300,
                height: 200,
            }}
            minWidth={200}
            minHeight={150}
            bounds="window" // Prevents dragging out of window
            enableResizing={{
                top: true,
                right: true,
                bottom: true,
                left: true,
                topRight: true,
                bottomRight: true,
                bottomLeft: true,
                topLeft: true,
            }}
            dragHandleClassName="drag-handle"
            className="custom-draggable"
        >
            <Paper elevation={3} style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
                <div className="drag-handle" style={{ padding: "10px", background: "#f5f5f5", color: "dark-grey", cursor: "grab", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Weather Widget</span>
                    <IconButton size="small" style={{ color: "dark-grey" }} onClick={() => setIsVisible(false)}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </div>
                <WeatherCard city="Sumy" tempScale="metric" />
            </Paper>
        </Rnd>
    );
};

const el = document.createElement("div");
document.body.appendChild(el);
const root = ReactDOM.createRoot(el);
root.render(<App />);