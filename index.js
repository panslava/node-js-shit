const express = require('express')
const bodyParser = require('body-parser')
const path = require("path");
const app = express()
const port = 8080

// support parsing of application/json type post data
app.use(bodyParser.json());

//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({extended: true}));
const multer = require('multer')

const audiosFolder = path.join(__dirname, './audios/')
const samplesFolder = path.join(__dirname, './samples/')

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, audiosFolder)
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now())
  }
})

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs')

app.use(express.static(audiosFolder)); /* this line tells Express to use the public folder as our static folder from which we can serve static files*/

app.get('/', (req, res) => {
  res.send('Hello World!')
})

const upload = multer({storage: storage})

function randomString(length) {
  let result = '';
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function removeFile(fileName) {
  if (fs.existsSync(fileName)) {
    fs.unlinkSync(fileName)
  }
}

function trimFromBeginning(src, length) {
  return new Promise(((resolve, reject) => {
    const randomFileName = audiosFolder + randomString(15) + '.mp3'
    const firsHalfReq = new ffmpeg({source: src});
    firsHalfReq.setStartTime(0) //Can be in "HH:MM:SS" format also
      .setDuration(length)
      .on("start", function (commandLine) {
        console.log("Spawned FFmpeg with command: " + commandLine);
      })
      .on("error", function (err) {
        removeFile(randomFileName)
        reject(err)
      })
      .on("end", function (err) {
        if (err) {
          removeFile(randomFileName)
          reject(err)
        }
        else {
          console.log("Trimmed from beginning");
          resolve(randomFileName)
        }
      }).saveToFile(randomFileName)
  }))
}

function trimFromEnd(src, startPoint) {
  return new Promise(((resolve, reject) => {
    const randomFileName = audiosFolder + randomString(15) + '.mp3'
    const firsHalfReq = new ffmpeg({source: src});
    firsHalfReq.setStartTime(startPoint)
      .on("start", function (commandLine) {
        console.log("Spawned FFmpeg with command: " + commandLine);
      })
      .on("error", function (err) {
        removeFile(randomFileName)
        reject(err)
      })
      .on("end", function (err) {
        if (err) {
          removeFile(randomFileName)
          reject(err)
        }
        else {
          console.log("Trimmed from end");
          resolve(randomFileName)
        }
      }).saveToFile(randomFileName)
  }))
}

function mergeFiles(firstFile, secondFile) {
  const resultFile = audiosFolder + 'result' + randomString(15) + '.mp3'
  return new Promise(((resolve, reject) => {
    ffmpeg(firstFile).input(secondFile).on('end', function () {
      console.log('files have been merged succesfully');
      resolve(resultFile)
    })
      .on('error', function (err) {
        removeFile(resultFile)
        reject(err)
      })
      .on('end', function (err) {
        if (err) {
          removeFile(resultFile)
          reject(err)
        }
        else {
          console.log('files have been merged succesfully');
          resolve(resultFile)
        }
      })
      .mergeToFile(resultFile);
  }))
}

app.post('/cut_audio', upload.single('audio'), async (req, res, next) => {
  const src = req.file.path
  try {
    const [firstFile, secondFile] = await Promise.all([trimFromBeginning(src, req.body.left), trimFromEnd(src, req.body.right)])
    const fileName = await mergeFiles(firstFile, secondFile)
    console.log('Files successfully merge, result: ' + fileName)
    res.status(200).sendFile(fileName, () => {

      fs.unlink(firstFile, () => {
      })
      fs.unlink(secondFile, () => {
      })
      fs.unlink(src, () => {
      })
      fs.unlink(fileName, () => {})
    })
  }
  catch (err) {
    fs.unlink(req.file.path, () => {
    });
    console.error(err)
    res.sendStatus(500)
  }

})


function fadeIn(fileName) {
  const resultFile = audiosFolder + 'result' + randomString(15) + '.mp3'
  return new Promise(((resolve, reject) => {
    ffmpeg(fileName).audioFilters('afade=t=in:ss=0:d=10')
      .on('error', function (err) {
        removeFile(resultFile)
        reject(err)
      })
      .on('end', function (err) {
        if (err) {
          removeFile(resultFile)
          reject(err)
        }
        else {
          console.log('files successfully fade in');
          resolve(resultFile)
        }
      })
      .saveToFile(resultFile)
  }))

}


app.post('/fade_in', upload.single('audio'), async (req, res, next) => {
  const src = req.file.path
  try {
    const fileName = await fadeIn(src)
    res.status(200).sendFile(fileName, () => {
      fs.unlink(src, () => {})
      fs.unlink(fileName, () => {})
    })
  }
  catch (err) {
    fs.unlink(req.file.path, () => {
    });
    console.error(err)
    res.sendStatus(500)
  }
})

function fadeOut(fileName, endPoint) {
  const resultFile = audiosFolder + 'result' + randomString(15) + '.mp3'
  return new Promise(((resolve, reject) => {
    ffmpeg(fileName).audioFilters('afade=t=out:st=' + endPoint + ':d=5')
      .on('error', function (err) {
        removeFile(resultFile)
        reject(err)
      })
      .on('end', function (err) {
        if (err) {
          removeFile(resultFile)
          reject(err)
        }
        else {
          console.log('files successfully fade in');
          resolve(resultFile)
        }
      })
      .saveToFile(resultFile)
  }))

}


app.post('/fade_out', upload.single('audio'), async (req, res, next) => {
  const src = req.file.path
  try {
    const fileName = await fadeOut(src, req.body.endPoint)
    res.status(200).sendFile(fileName, () => {
      fs.unlink(src, () => {})
      fs.unlink(fileName, () => {})
    })
  }
  catch (err) {
    fs.unlink(req.file.path, () => {
    });
    console.error(err)
    res.sendStatus(500)
  }
})

function mixSounds(firstPath, secondPath) {
  const resultFile = audiosFolder + 'result' + randomString(15) + '.mp3'
  return new Promise(((resolve, reject) => {
    ffmpeg(firstPath).input(secondPath).complexFilter('amix=inputs=2:duration=longest')
      .on('error', function (err) {
        removeFile(resultFile)
        reject(err)
      })
      .on('end', function (err) {
        if (err) {
          removeFile(resultFile)
          reject(err)
        }
        else {
          console.log('files successfully mixed');
          resolve(resultFile)
        }
      })
      .saveToFile(resultFile)
  }))

}

app.post('/add_music', upload.single('audio'), async (req, res, next) => {
  const src = req.file.path
  try {
    const musicName = {
      'verka': 'music_fun.mp3',
      'trombone': 'trombone.mp3',
      'laugh': 'laugh.mp3',
      'rabbits': 'rabbits.mp3'
    }
    const fileName = await mixSounds(src, path.resolve(samplesFolder + musicName[req.body.music]))
    res.status(200).sendFile(fileName, () => {
      fs.unlink(src, () => {
      })
      fs.unlink(fileName)
    })
  }
  catch (err) {
    fs.unlink(req.file.path, () => {
    });
    console.error(err)
    res.sendStatus(500)
  }
})


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
