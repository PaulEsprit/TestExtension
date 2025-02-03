import * as React from 'react'
import { render } from 'react-dom'
import './popup.css'
import { fetchOpenWeatherData } from '../utils/api'
import WeatherCard from './WeatherCard'

const App: React.FC<{}> = () => {

  React.useEffect(() => {
    fetchOpenWeatherData('Toronto')
      .then(data => console.log(data))
      .catch(error => console.error(error))
  }, [])

  return (
    <div>
      <WeatherCard city="Toronto" />
    </div>
  )
}

const root = document.createElement('div')
document.body.appendChild(root)
render(<App />, root)
