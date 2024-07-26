(async function () {
  const fs = require('fs');
  const swearWords = require('./swear-words.json');

  const videos = getVideoNames();

  for (const video of videos) {
    const { name, ext } = getName(video);
    console.log('\x1b[33m', `Name: ${name}`);
    console.log('\x1b[0m', '');
    // check for srt file. if not found, try to extract it.
    const subName = `${name}.srt`
    if (!fs.existsSync(subName)) {
      const subExist = await extractSrt(video, subName);
      // if no subtitle found, use AI to transcribe video.
      if (!subExist) {
        console.log('\x1b[35m', 'Could not extract subtitles.\nStarting Docker with AI transcription.\nThis will take a few minutes to transcribe video.');
        console.log('\x1b[0m', '');
        const out = await transcribeVideo(video);
        // check if there are swear words.
        if (/No swear words found/.test(out.stdout)) {
          console.log('\x1b[35m', 'Transcription done! No Swearwords found.');
          console.log('\x1b[0m', '');
          return
        }
        // encode output video with ffmpeg.
        await encodeVideo(name, `${name}-output.${ext}`)
        const removedFiles = [
          `${name}-cut.txt`,
          `${name}.json`,
          `${name}-output.${ext}`,
        ];
        deleteFiles(removedFiles)
        return
      }
    } else {
      console.log('\x1b[33m', `\n${subName} does not need to be extracted.`);
      console.log('\x1b[0m', '');
    }

    // find swear-words. fix times in new srt file. show returned words.
    const { newSrt, cutArr, cutTxt } = await getCuts(video, subName);
    // console.log(newSrt);
    // console.log(cutArr);
    // print the new srt clean file.
    const cleanSrtName = `${name}-clean.srt`
    fs.writeFileSync(cleanSrtName, newSrt)
    fs.writeFileSync(`${name}_cut_words.txt`, cutTxt)

    // create video slices points.
    const demuxerFileName = await createSliceFile(video, cutArr);
    // console.log(demuxerFileName);

    // run demuxerFile, slice video, concat.
    console.log("\x1b[32m", "Slicing and Joining Video");
    // reset color
    console.log("\x1b[0m", '');
    const joinedVideoName = await joinVideo(name, ext, demuxerFileName)
    // console.log(joinedVideoName);

    // encode video
    console.log("\x1b[32m", "Encoding Video. This may take a while...");
    console.log("\x1b[0m", '');
    const cleanVideo = await encodeVideo(name, joinedVideoName, true)
    console.log("\x1b[32m", `Finished! ${cleanVideo} is ready!`);
    console.log("\x1b[0m", '');


    // delete working files.
    const deletes = [
      cleanSrtName,
      demuxerFileName,
      joinedVideoName
    ]
    deleteFiles(deletes)
  }


  function deleteFiles(files) {
    for (const file of files) {
      fs.unlink(file, (e) => {
        if (e) throw Error(e);
        console.log("\x1b[34m", `${file} was deleted`);
        console.log("\x1b[0m", '');
      })
    }
  }

  // return array of video names
  function getVideoNames() {
    const vidext = [
      '\\.mp4$',
      '\\.mkv$',
      '\\.avi$',
      '\\.webm$',
    ]
    const extRegex = new RegExp(vidext.join('|'))
    const avoidVideos = [
      'output',
      'clean'
    ]
    const avoidRegex = new RegExp(avoidVideos.map(a => vidext.map(v => `${a}${v}`).join('|')).join('|'))
    // console.log('regex', avoidRegex);
    const videos = fs.readdirSync(process.cwd())
      .filter(file => extRegex.test(file))
      .filter(file => !avoidRegex.test(file));
    console.log(videos);
    return videos
  }

  // AI transcribe
  async function transcribeVideo(video) {
    const dockerArgs = [
      'run', '--rm',
      '-v', `${process.cwd()}:/data`,
      '-v', `${process.cwd()}/.whisper:/app/.whisper`, 'jveldboom/video-swear-jar:v1',
      'clean',
      '--input', video,
      '--model', 'tiny.en',
      '--language', 'en',
    ]
    return await spawnShell('docker', dockerArgs);
  }

  // try to extract srt.
  async function extractSrt(video, subName, subNumber = 0) {
    // file does not exist
    const args = [
      '-hide_banner',
      '-v', 'error',
      '-i', video,
      '-map', `0:s:${subNumber}?`,
      subName
    ]
    try {
      await spawnShell('ffmpeg', args)
      console.log('\x1b[34m', `Extracted ${subName}`);
      console.log('\x1b[0m', '');
      return true;
    } catch (error) {
      console.log('No srt found!');
      // throw Error(error)
      return false;
    }
  }

  // encode Video
  async function encodeVideo(name, joinedVideoName, subTitles = false) {
    const cleanVideoName = `${name}-clean.mp4`
    const subTitleName = `${name}-clean.srt`;
    // if no srt file is passed, just encode the output file.
    let args = [];
    if (subTitles) {
      args = [
        '-y',
        '-hwaccel', 'cuda',
        '-i', joinedVideoName,
        '-i', subTitleName,
        '-c:v', 'nvenc_hevc',
        '-preset', 'fast',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-c:s', 'mov_text',
        '-metadata:s:s:0', 'language=eng',
        cleanVideoName
      ]
    } else {
      args = [
        '-y',
        '-hwaccel', 'cuda',
        '-i', joinedVideoName,
        '-c:v', 'nvenc_hevc',
        '-preset', 'fast',
        '-c:a', 'aac',
        '-b:a', '128k',
        cleanVideoName
      ]
    }
    await spawnShell('ffmpeg', args);
    return cleanVideoName
  }

  // concat video
  async function joinVideo(name, ext, demuxerFileName) {
    const concatVideoName = `${name}-output.${ext}`
    const args = [
      '-y',
      '-v', 'error',
      '-f', 'concat',
      '-i', demuxerFileName,
      '-c:v', 'copy',
      '-c:a', 'copy',
      concatVideoName
    ];
    await spawnShell('ffmpeg', args)
    return concatVideoName
  }

  // slice video
  async function createSliceFile(video, cutArr) {
    // create demuxer concat file.
    // outpoint may be in seconds, so skip converting time.
    const demuxerFile = cutArr.reduce((acc, cur) => {
      const text = `file '${video}'
inpoint ${timeToSeconds(cur.startCut)}
${cur.endCut ? 'outpoint ' + timeToSeconds(cur.endCut) : ''}
`
      return acc += text
    }, '')
    // console.log('demuxerFile', demuxerFile);
    const demuxerFileName = `${getName(video).name}-demuxer.txt`
    fs.writeFileSync(demuxerFileName, demuxerFile)
    return demuxerFileName;
  }

  function fixDecimal(num) {
    return +(Math.round(num + 'e+3') + 'e-3');
  }
  function timeToSeconds(time) {
    if (!time) return '';
    const [hour, min, sec, milli] = time.split(/:|,/);
    // console.log(time, hour, min, sec, milli);
    const totalSec = (+hour * 60 * 60) + (+min * 60) + (+sec)
    return +(`${totalSec}.${milli}`)
  }
  function secondsToTime(time) {
    // return timeStamp format.
    const [sec, milli = '000'] = time.toString().split('.');
    const hours = Math.floor(sec / 3600);
    const hourStr = hours.toString().padStart(2, '0');
    const minutes = Math.floor((sec % 3600) / 60);
    const minuteStr = minutes.toString().padStart(2, '0');
    const seconds = sec - (hours * 3600 + minutes * 60);
    const secStr = seconds.toString().padStart(2, '0');
    const milliStr = milli.toString().padEnd(3, '0');
    // console.log('time', time, 'hours', hours, 'minutes', minutes, 'seconds', seconds, 'milli', milli);
    return `${hourStr}:${minuteStr}:${secStr},${milliStr}`
  }
  function getName(name) {
    const videoName = name.split('.');
    const ext = videoName.pop();
    return { name: videoName.join('.'), ext };
  }

  // subtract time -returns the time in seconds.
  function addSubtractSec(operator = '-', sec1, sec2) {
    const t1 = fixDecimal(sec1 * 1000);
    const t2 = fixDecimal(sec2 * 1000);
    // add
    if (operator === '+') return Math.abs(fixDecimal((t2 + t1) / 1000));
    // subtract
    return Math.abs(fixDecimal((t2 - t1) / 1000));
  }

  async function getCuts(video, srtFile) {
    const srt = fs.readFileSync(srtFile, 'utf-8');
    // console.log(srt);
    // read srt, split into blocks. -convert to object.
    const srtArr = srt.split(/\r?\n\r?\n\d{1,5}\r?\n?$/m)
      .map((block, idx) => {
        // console.log('block', block);
        let rawTime = '';
        let text = '';
        // first line will keep id
        if (idx > 0) {
          [rawTime, ...text] = block.trim().split(/\r?\n/);
        } else {
          [_, rawTime, ...text] = block.trim().split(/\r?\n/);
        }
        // console.log('rawTime', rawTime, 'text', text);
        const [start, end] = rawTime.split(' --> ');
        return {
          id: idx + 1, start, end, text: text.join('\n').trim()
        }
      })
    // console.log(srtArr);
    // return { newSrt: '', cutArr: '', cutTxt: '' }
    // new srt.
    const newSrtArr = []
    // track cut words
    const cutTxtArr = []
    // inverse the keep segments.
    const cutArr = []
    let totalSecondsRemoved = 0;
    let startCut = '00:00:00,000';
    for (const { id, start, end, text } of srtArr) {
      // console.log(start, end);
      if (containsSwearWords(text)) {
        cutArr.push({ startCut, endCut: start, text, end });
        cutTxtArr.push({ id, start, end, text })
        startCut = end
        // add time removed
        const secRemoved = addSubtractSec('-', timeToSeconds(end), timeToSeconds(start));
        totalSecondsRemoved = addSubtractSec('+', totalSecondsRemoved, secRemoved)
      } else {
        // update subtitles with removed seconds from cut video.
        // console.log(totalSecondsRemoved);
        const startSec = timeToSeconds(start)
        const endSec = timeToSeconds(end)
        const startFix = secondsToTime(addSubtractSec('-', startSec, totalSecondsRemoved));
        const endFix = secondsToTime(addSubtractSec('-', endSec, totalSecondsRemoved));
        // console.log(start, startFix, end, endFix);
        // push clean srt.
        newSrtArr.push({ id, start: startFix, end: endFix, text })
      }
    }
    cutArr.push({ startCut, endCut: '', text: '', end: '' })

    // create new srt file.
    const newSrt = newSrtArr.map((b, idx) => ({ ...b, id: idx + 1 }))
      .reduce((acc, cur) => {
        const { id, start, end, text } = cur
        return acc += `${id}
${start} --> ${end}
${text}

`
      }, '')
    // Create string of cut words.
    const cutTxt = cutTxtArr.reduce((acc, cur) => {
      const { id, start, end, text } = cur
      return acc += `${start} - ${end} \t${text.replace(/\r?\n/, ' ')}\n`
    }, '')
    return { newSrt, cutArr, cutTxt }
  }

  function containsSwearWords(text) {
    const pattern = swearWords.join('|')
    const regex = new RegExp(`\\b(?:${pattern})\\b`, 'i') // 'i' flag for case-insensitive matching
    if (regex.test(text) || /!remove!/.test(text)) return true
    return false
  }

  async function spawnShell(command, args = []) {
    const { spawn } = require('child_process');
    return new Promise((resolve, reject) => {
      console.log(`running command: ${command} ${args.join(' ')}`);
      const process = spawn(command, args);
      let stdout = '';
      let stderr = '';
      process.stdout.on('data', (data) => {
        console.log(data.toString());
        stdout += data;
      });
      process.stderr.on('data', (data) => {
        console.log(data.toString());
        stderr += data;
      });
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const error = new Error(`Command "${command} ${args.join(' ')}" exited with code ${code}`);
          error.code = code;
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        }
      });
      process.on('error', (error) => {
        reject(error);
      });
    });
  }
})()