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
// Global variable for frame grab interval
let frameGrabInterval = 3000; // Default to 3 seconds
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
// Function to grab the latest frame
async function grabLatestFrame(camera) {
  var framePath = path.join(__dirname, 'camera_frames', camera.id.toString(), 'last.jpg');
  fs.readFile(framePath, function(err, data) {
    if (err) {
      console.error('Error reading frame');
    } else {
      console.log('Grabbed latest frame for camera ' + camera.id);
      // TODO: Store the frame data as needed
    }
  });
}
async function startStream(camera) { 
  const app = express(),
    publicOutputDirectory = path.join(__dirname, 'public/output')
    if (!(await promisify(fs.exists)(publicOutputDirectory))) {
      await promisify(fs.mkdir)(publicOutputDirectory)
    }
    if (!camera.frameRate) {
      camera.frameRate = 3;
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
        '-vf', 'fps=' + (1 / camera.frameRate), // This sets the frame rate to 1 frame every X seconds
        '-s', '1920x1080', // This sets the frame resolution to 1920x1080
        // '-update', '1', // This makes sure the output file is overwritten
        path.join(publicOutputDirectory, `${camera.name}.jpg`), // Output to a .jpg file
      ],
    })
    camera.call = call
    // Set a property to indicate that the stream should be restarted if it ends
    camera.shouldRestart = true
    call.onCallEnded.subscribe(() => {
      console.log('Call has ended')
      // const childProcess = spawn(`npm run browser-example "${cameraName}"`, [], { shell: true, stdio: 'inherit' });

      if (camera.shouldRestart) {
        console.log('Restarting stream for camera ' + camera.id)
        startStream(camera)
      }
      //process.exit()
    })
    
console.log('Camera of '+camera.name+' Streamming is Started ')

console.log('Camera of '+camera.name+' Streamming is Started and farme rate is '+camera.frameRate)
camera.isStreaming = true
// camera.frameGrabIntervalId = setInterval(() => grabLatestFrame(camera), frameGrabInterval);
}
// Convert fs.unlink into a promise-based function
const unlink = util.promisify(fs.unlink)
// Convert fs.readdir into a promise-based function
const readdir = util.promisify(fs.readdir)
async function stopStream(camera) {
  // Check if the camera has a call to stop
  if (camera.call) {
    console.log('Stopping stream for camera ' + camera.id)
    // Set the property to indicate that the stream should not be restarted
    camera.shouldRestart = false
    camera.call.stop()
    camera.isStreaming = false
    camera.call = null
  // Wait for 2 seconds before deleting the stream file
  setTimeout(async () => {
    const filePath = path.join(__dirname, 'public/output', `${camera.name}.jpg`)
    try {
      await unlink(filePath)
      console.log('Deleted stream file for camera ' + camera.id)
    } catch (err) {
      console.error('Failed to delete stream file for camera ' + camera.id, err)
    }
   }, 2000)
} else {
  console.log('No stream to stop for camera ' + camera.id)
}
clearInterval(camera.frameGrabIntervalId);
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
    // Start fetching frames when the streaming starts
    var framePath = path.join(__dirname, 'camera_frames', camera.id.toString(), 'last.jpg');
    fs.readFile(framePath, function(err, data) {
      if (err) {
        console.error('Error reading frame');
      } else {
        console.log('Started fetching frames for camera ' + cameraId);
      }
    });
  }
  
  
  // Save the new state
  const savedStates = JSON.parse(fs.readFileSync(path.join(__dirname, 'cameraStates.json'), 'utf-8'))
  savedStates[camera.id] = camera.isStreaming
  fs.writeFileSync(path.join(__dirname, 'cameraStates.json'), JSON.stringify(savedStates))

  res.json({ success: true, isStreaming: camera.isStreaming })
})

// Endpoint to set frame grab interval
app.post('/cameras/:id/set-frame-grab-interval', (req, res) => {
  const cameraId = Number(req.params.id);
  const newInterval = req.body.interval;
  const camera = cameras.find(cam => cam.id === cameraId);
  if (camera && newInterval && typeof newInterval === 'number' && newInterval > 0) {
    clearInterval(camera.frameGrabIntervalId);
    camera.frameGrabIntervalId = setInterval(() => grabLatestFrame(camera), newInterval);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid interval or camera id' });
  }
});

app.post('/cameras/:id/set-frame-rate/:frame', (req, res) => {
  const cameraId = Number(req.params.id);
  if (cameraId) {
    console.log(cameraId)
  }
  console.log(Number(req.params.frame))
  console.log(JSON.stringify(req.body));
  const newFrameRate = Number(req.params.frame);
if (!isNaN(newFrameRate) && newFrameRate > 0) {
  console.log('New frame rate: ' + newFrameRate);
} else {
  console.log('Invalid frame rate');
}
  const camera = cameras.find(cam => cam.id === cameraId);
  if (camera) {
    console.log(camera.name)
  }

  if (camera && newFrameRate) {
    camera.frameRate = newFrameRate;
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid frame rate or camera id' });
  }
});


// Start server
app.listen(3000, () => {
  console.log('Server is running on port 3000')
  fetchCameras()
})
