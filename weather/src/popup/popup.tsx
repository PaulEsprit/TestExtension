import * as React from 'react'
import * as ReactDOM from "react-dom/client";
import { Box, InputBase, IconButton, Paper, Grid2 as Grid } from '@mui/material'
import { Add as AddIcon, OpenInBrowser as OpenInBrowserIcon } from '@mui/icons-material';
import './popup.css'
import 'fontsource-roboto'
import { fetchOpenWeatherData } from '../utils/api'
import WeatherCard from '../components/WeatherCard'
import { 
  setStoradeCities, 
  getStoradeCities,
  setStorageOptions,
  getStorageOptions,
  LocalStorageOptions } from '../utils/storage'


const App: React.FC<{}> = () => {
  const [cities, setCities] = React.useState<string[]>([
    'Sumy'
  ])

  const[cityInput, setCityInput] = React.useState<string>('')

  const[options, setOptions] = React.useState<LocalStorageOptions | null>({
    tempScale: 'metric'
  })

  React.useEffect(() => {
    getStoradeCities()
      .then(cities => setCities(cities))
      .catch(error => console.error(error))

    getStorageOptions()
      .then(options => setOptions(options))
      .catch(error => console.error(error))  
  },[])

  const handleAddCity = () => {
    if (cityInput === '') return 
    const newCities = [...cities, cityInput]  
    setStoradeCities(newCities)
    .then(() => {
      setCities(newCities)    
      setCityInput('')
    })
    .catch(error => console.error(error))     
  }

  const handleDeleteCity = (index: number) => {
    const newCities = cities.filter((city, i) => i !== index)    
    setStoradeCities(newCities)
    .then(() => {
      setCities(newCities)
    })
    .catch(error => console.error(error))
  }

  const handleTempScaleChange = () => {
    const newOptions: LocalStorageOptions = {
      ...options,
      tempScale: options.tempScale === 'metric' ? 'imperial' : 'metric'
    }

    setStorageOptions(newOptions)
    .then(() => {
      setOptions(newOptions)
    })
    .catch(error => console.error(error))
  }

  const handleOpenModal = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "toggleWeatherWidget" });
    });
  }  

  if (!options) {
    return null
  }

  return (
    <Box mx={"8px"} my={"8px"}>
      <Box px={"15px"} py={"5px"}>
        <Paper elevation={0}>
          <Grid container>
            <Grid alignItems={"end"}>
              <IconButton onClick={handleOpenModal}>
                  <OpenInBrowserIcon />
                </IconButton>
            </Grid>
          </Grid>
        </Paper>
        <Paper>
          <Grid container spacing={1} justifyContent={"space-evenly"}>
            <Grid size={8}>
              <Box sx={{ margin: "5px 0px 0px 10px" }}>
                <InputBase placeholder="Add city name" 
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                />
              </Box>
            </Grid>
            <Grid size={2}>
                <IconButton onClick={handleAddCity}>
                  <AddIcon />
                </IconButton>
            </Grid>
            <Grid size={2}>
                <Box sx={{ margin: "0px 10px 0px 0px" }}>
                <IconButton onClick={handleTempScaleChange}>
                  {options.tempScale === 'metric' ? '\u2103' : '\u2109'}
                </IconButton>
                </Box>
            </Grid>
          </Grid>
        </Paper>
      </Box>
      {
        options.homeCity !== '' && 
        <WeatherCard 
        city={options.homeCity} 
        tempScale={options.tempScale} 
        />
      }
      {cities.map((city, index) => (
        <WeatherCard 
        key={index} city={city} 
        tempScale={options.tempScale} 
        onDelete={() => handleDeleteCity(index)}/>
      ))}
    </Box>
  );
}

const el = document.createElement('div')
document.body.appendChild(el)
const root = ReactDOM.createRoot(el)
root.render(<App />);
