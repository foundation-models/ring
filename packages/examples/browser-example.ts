import 'dotenv/config'
import { RingApi } from '../ring-client-api'
import { promisify } from 'util'
const fs = require('fs'),
  path = require('path'),
  express = require('express')
  import { spawn } from 'child_process';
  
/**
 * This example creates an hls stream which is viewable in a browser
 * It also starts web app to view the stream at http://localhost:3000
 **/


// Get the camera name from the command line arguments
const cameraName = process.argv[2];


// Read the JSON file
let rawData = fs.readFileSync('/home/agent/workspace/isights/data.json');
let name = JSON.parse(rawData);




let cameraTostream = 0;
console.log(name[9].name);
async function example() {
  const ringApi = new RingApi({
      // Replace with your refresh token
      refreshToken: process.env.RING_REFRESH_TOKEN!,
      debug: true,
    }),
    // [camera] = await ringApi.getCameras(),
    cameras = await ringApi.getCameras()
    for (let index = 0; index < cameras.length; index++) {
      const element = cameras[index];
      if (element.name === name[9].name) {
        cameraTostream = index
    }
      console.log(element.name,element.id,index)
    }
    
  
  if (!cameras[cameraTostream]) {
    console.log('No cameras found')
    return
  }else{
    console.log('hereeeeeeeeee',cameras[cameraTostream].name)
  }
  const app = express(),
    publicOutputDirectory = path.join(__dirname, 'public/output')

  app.use('/', express.static(path.join(__dirname, 'public')))
  app.listen(3000, () => {
    console.log(
      'Listening on port 3000.  Go to http://localhost:3000 in your browser',
    )
  })

  if (!(await promisify(fs.exists)(publicOutputDirectory))) {
    await promisify(fs.mkdir)(publicOutputDirectory)
  }

  const call = await cameras[cameraTostream].streamVideo({
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
      path.join(publicOutputDirectory, 'stream.m3u8'),
    ],
  })

  call.onCallEnded.subscribe(() => {
    console.log('Call has ended')
    const childProcess = spawn('npm run browser-example', [], { shell: true, stdio: 'inherit' });
    process.exit()
  })

  setTimeout(
    function () {
      console.log('Stopping call...')
      const childProcess = spawn('npm run browser-example', [], { shell: true, stdio: 'inherit' });
      call.stop()
    },
    1440 * 60 * 1000,
  ) // Stop and respawn after 1440 minutes.
}

example().catch((e) => {
  console.error(e)
  process.exit(1)
})
