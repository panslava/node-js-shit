const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const port = 3001

// support parsing of application/json type post data
app.use(bodyParser.json());

//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({ extended: true }));
const multer  = require('multer')

const audiosFolder = './audios/'

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
const path = require("path");

app.use(express.static('./audios/')); /* this line tells Express to use the public folder as our static folder from which we can serve static files*/

app.get('/', (req, res) => {
  res.send('Hello World!')
})

const upload = multer({ storage: storage })

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
  if (fs.existsSync(audiosFolder + fileName)) {
    fs.unlinkSync(audiosFolder + fileName)
  }
}

function trimFromBeginning(src, length) {
  return new Promise(((resolve, reject) => {
    const randomFileName =  audiosFolder + randomString(15) + '.mp3'
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
        }
        else {
          console.log('files have been merged succesfully');
          resolve(resultFile)
        }
      })
      .mergeToFile(resultFile);
  }))
}

app.post('/cut_audio', upload.single('audio'), async (req, res) => {
  const src = req.file.path
  try {
    const [firstFile, secondFile] = await Promise.all([trimFromBeginning(src, req.body.left), trimFromEnd(src, req.body.right)])
    const fileName = await mergeFiles(firstFile, secondFile)
    console.log('Files successfully merge, result: ' + fileName)
    res.status(200).sendFile(path.resolve(fileName), function (err) {
      if (err) {
        next(err);
      }
      else {
        try {
          fs.unlink(fileName, () => {});
          fs.unlink(firstFile, () => {});
          fs.unlink(secondFile, () => {});
          fs.unlink(req.file.path, () => {});
        }
        catch (e) {
          console.error(e)
          console.log("error removing ", fileName);
        }
      }
    })
  }
  catch (err) {
    console.error(err)
    res.sendStatus(500)
  }

})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
