import * as React from 'react'
import { fetchOpenWeatherData, OpenWeatherData, OpenWeatherTempScale } from '../../utils/api'
import DeleteIcon from '@mui/icons-material/Delete';
import { 
  CardActions,
   CardContent,
    Card, 
    Box, 
    Button,
    Typography } from '@mui/material'

const WeatherCardContainer: React.FC<{
  children: React.ReactNode,
  onDelete?: () => void
}> = ({children, onDelete}) => {
    return (
        <Box my={"4px"} mx={"16px"}>
        <Card>
          <CardContent>
            {children}
          </CardContent>
          <CardActions>
            { onDelete &&
              <Button 
              size="small" 
              startIcon={<DeleteIcon />} 
              color='error'
              onClick={onDelete}>
                Delete
              </Button>
            }
          </CardActions>
        </Card>
      </Box>
    )
}

type WeatherCardState = 'loading' | 'error' | 'ready'

const WeatherCard: React.FC<{
  city: string,
  tempScale: OpenWeatherTempScale,
  onDelete?: () => void
 }> = ({city, tempScale, onDelete}) => {

    const [weatherData, setWeatherData] = React.useState<OpenWeatherData | null>(null)
    const [cardState, setCardState] = React.useState<WeatherCardState>('loading')

    React.useEffect(() => {
        fetchOpenWeatherData(city, tempScale)
            .then(data => {
                setWeatherData(data)
                setCardState('ready')
            })
            .catch(error => {
                setCardState('error')
            })
    }, [city, tempScale])

    if (cardState == 'error' || cardState == 'loading') {
      return (
        <WeatherCardContainer onDelete={onDelete}>
          <Typography variant="body1">
            { cardState == 'error' ? 'Failed to load data' : 'Loading...' }
          </Typography>
        </WeatherCardContainer>
      );
    }

    return (
      <WeatherCardContainer onDelete={onDelete}>
        <Typography variant="h5">{weatherData.name}</Typography>
        <Typography variant="body1">
          {Math.round(weatherData.main.temp)}
        </Typography>
        <Typography variant="body1">
          Feel likes: {weatherData.main.feels_like}
        </Typography>
      </WeatherCardContainer>
    );
}

export default WeatherCard