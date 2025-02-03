import * as React from 'react'
import { fetchOpenWeatherData } from '../../utils/api'


const WeatherCard: React.FC<{city: string }> = ({city}) => {

    React.useEffect(() => {
        fetchOpenWeatherData(city)
            .then(data => console.log(data))
            .catch(error => console.error(error))
    }, [city])

    return (
        <div>
            <h2>{city}</h2>
        </div>
    )
}

export default WeatherCard