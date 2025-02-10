import * as React from "react";
import * as ReactDOM from "react-dom/client";
import {
  Card,
  CardContent,
  Typography,
  Grid2 as Grid,
  TextField,
  Button,
  Box,
} from "@mui/material";
import "fontsource-roboto";
import "./options.css";
import {
  LocalStorageOptions,
  getStorageOptions,
  setStorageOptions,
} from "../utils/storage";
import { OpenWeatherTempScale } from "../utils/api";

const App: React.FC<{}> = () => {
  const [homeCity, setHomeCity] = React.useState<string>("");
  const [tempScale, setTempScale] =
    React.useState<OpenWeatherTempScale>("metric");

  React.useEffect(() => {
    getStorageOptions()
      .then((options) => {
        setHomeCity(options.homeCity);
        setTempScale(options.tempScale);
      })
      .catch((error) => console.error(error));
  }, []);

  const handleHomeCityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setHomeCity(event.target.value);
  };

  const handleAddHomeCity = () => {
    if (homeCity === "") return;
    const newOptions: LocalStorageOptions = {
      homeCity,
      tempScale: tempScale,
    };
    setStorageOptions(newOptions)
      .then(() => {
        setHomeCity(homeCity);
      })
      .catch((error) => console.error(error));
  };

  return (
    <div>
      <Box mx={"10%"} my={"2%"}>
        <Card>
          <CardContent>
            <Grid container direction={"column"} spacing={2}>
              <Grid>
                <Typography variant="h5">Options page</Typography>
              </Grid>
              <Grid container direction={"row"} spacing={2}>
                <Grid size={10}>
                  <TextField
                    label="Home City"
                    variant="outlined"
                    fullWidth
                    value={homeCity}
                    onChange={handleHomeCityChange}
                  />
                </Grid>
                <Grid size={2}>
                  <Box sx={{ margin: "10px 0 0 0" }}>
                    <Button color="primary" onClick={handleAddHomeCity}>
                    Save
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </div>
  );
};

const el = document.createElement("div");
document.body.appendChild(el);
const root = ReactDOM.createRoot(el);
root.render(<App />);
