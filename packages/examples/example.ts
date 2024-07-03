import 'dotenv/config'
import { RingApi } from '../ring-client-api'
import express from 'express'
import bodyParser from 'body-parser'
import path from 'path'

// ...

const publicDirectory = path.join(__dirname, '/public')

const app = express()
app.use('/', express.static(publicDirectory))
app.use(bodyParser.json())
// app.use('/', express.static(__dirname))
let cameras = []

// Initialize Ring API
const ringApi = new RingApi({
  refreshToken: process.env.RING_REFRESH_TOKEN!,
  debug: true,
})

// Fetch cameras
async function fetchCameras() {
  console.log('Fetching cameras...')
  cameras = await ringApi.getCameras()
  console.log('Fetched ' + cameras.length + ' cameras')
  // Log the IDs of the fetched cameras
  console.log('Camera IDs:', cameras.map(camera => camera.id))
}

// Endpoint to get camera list
app.get('/cameras', (req, res) => {
  // res.send('Welcome to the Camera Control Panel!')
  const cameraList = cameras.map(camera => ({ id: camera.id, name: camera.name }))
  res.json(cameraList)
})
async function startStream(camera) {
  console.log('Camera of '+camera.name+' Streamming is Started ')
  camera.isStreaming = true
}

async function stopStream(camera) {
  // Your logic to stop the stream
  console.log('Camera of '+camera.name+' Streamming is Stoped ')
  camera.isStreaming = false
}
// Endpoint to toggle camera stream
app.post('/cameras/:id/toggle', async (req, res) => {
  const cameraId = Number(req.params.id) // Convert the ID to a number
  console.log('Received request to toggle stream for camera ' + cameraId)

  // Log the current state of the cameras array
  console.log('Current cameras:', cameras.map(camera => camera.id))

  const camera = cameras.find(cam => cam.id === cameraId)

  if (!camera) {
    console.log('Camera not found: ' + cameraId)
    return res.status(404).json({ error: 'Camera not found' })
  }

  if (camera.isStreaming) {
    console.log('Stopping stream for camera ' + cameraId)
    await stopStream(camera)
  } else {
    console.log('Starting stream for camera ' + cameraId)
    await startStream(camera)
  }

  res.json({ success: true, isStreaming: camera.isStreaming })
})


// Start server
app.listen(3000, () => {
  console.log('Server is running on port 3000')
  fetchCameras()
})
