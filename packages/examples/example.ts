import 'dotenv/config'
import { RingApi } from '../ring-client-api'
import express from 'express'
import util from 'util'
import { promisify } from 'util'
import bodyParser from 'body-parser'
import path from 'path'
import fs from 'fs'
// ...

const publicDirectory = path.join(__dirname, '/public')
const publicOutputDirectory = path.join(__dirname, 'public/output')
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

  // Load the saved states
  const stateFilePath = path.join(__dirname, 'cameraStates.json')
  let savedStates = {}
  if (fs.existsSync(stateFilePath)) {
    savedStates = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'))
  } else {
    fs.writeFileSync(stateFilePath, JSON.stringify(savedStates))
  }
  cameras.forEach(camera => {
    if (savedStates[camera.id]) {
      camera.isStreaming = savedStates[camera.id]
    }
  })
}

// Endpoint to get camera list
// Endpoint to get camera list
app.get('/cameras', (req, res) => {
  console.log('Received request for camera list')
  const cameraList = cameras.map(camera => ({ id: camera.id, name: camera.name, isStreaming: camera.isStreaming }))
  res.json(cameraList)
})
async function startStream(camera) { 
  const app = express(),
    publicOutputDirectory = path.join(__dirname, 'public/output')
    if (!(await promisify(fs.exists)(publicOutputDirectory))) {
      await promisify(fs.mkdir)(publicOutputDirectory)
    }
    
  
    const call = await camera.streamVideo({
      output: [
        '-preset',
        'veryfast',
        '-g',
        '25',
        '-sc_threshold',
        '0',
        '-f',
        'hls',
        '-hls_time',
        '2',
        '-hls_list_size',
        '6',
        '-hls_flags',
        'delete_segments',
        '-an',
        path.join(publicOutputDirectory, `${camera.name}`+`_stream.m3u8`),
      ],
    })
    camera.call = call
    
    call.onCallEnded.subscribe(() => {
      console.log('Call has ended')
      // const childProcess = spawn(`npm run browser-example "${cameraName}"`, [], { shell: true, stdio: 'inherit' });
      //process.exit()
    })
    
console.log('Camera of '+camera.name+' Streamming is Started ')
camera.isStreaming = true
}
// Convert fs.unlink into a promise-based function
const unlink = util.promisify(fs.unlink)
async function stopStream(camera) {
  // Check if the camera has a call to stop
  if (camera.call) {
    console.log('Stopping stream for camera ' + camera.id)
    camera.call.stop()
    camera.isStreaming = false
    camera.call = null
  // Delete the stream file
  const filePath = path.join(__dirname, 'public/output', `${camera.name}_stream.m3u8`)
  try {
    await unlink(filePath)
    console.log('Deleted stream file for camera ' + camera.id)
  } catch (err) {
    console.error('Failed to delete stream file for camera ' + camera.id, err)
  }
} else {
  console.log('No stream to stop for camera ' + camera.id)
}
}
// Endpoint to toggle camera stream
app.post('/cameras/:id/toggle', async (req, res) => {
  const cameraId = Number(req.params.id)
  console.log('Received request to toggle stream for camera ' + cameraId)

  const camera = cameras.find(cam => cam.id === cameraId)

  if (!camera) {
    console.log('Camera not found: ' + cameraId)
    return res.status(404).json({ error: 'Camera not found' })
  }

  if (camera.isStreaming) {
    console.log('Stopping stream for camera ' + cameraId)
    await stopStream(camera)
    camera.isStreaming = false
  } else {
    console.log('Starting stream for camera ' + cameraId)
    await startStream(camera)
    camera.isStreaming = true
  }

  // Save the new state
  const savedStates = JSON.parse(fs.readFileSync(path.join(__dirname, 'cameraStates.json'), 'utf-8'))
  savedStates[camera.id] = camera.isStreaming
  fs.writeFileSync(path.join(__dirname, 'cameraStates.json'), JSON.stringify(savedStates))

  res.json({ success: true, isStreaming: camera.isStreaming })
})


// Start server
app.listen(3000, () => {
  console.log('Server is running on port 3000')
  fetchCameras()
})
