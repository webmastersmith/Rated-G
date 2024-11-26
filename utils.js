const fs = require('fs');
const swearWords = require('./swear-words.json');

/**
 * Subtract or add floats.
 * @param {string} operator +|-
 * @param {float} sec1 Seconds.milliseconds
 * @param {float} sec2 Seconds.milliseconds
 * @returns float. seconds.milliseconds to third decimal place.
 */
function addSubtractSec(operator = '-', sec1, sec2) {
  const t1 = fixDecimal(sec1 * 1000);
  const t2 = fixDecimal(sec2 * 1000);
  // add
  if (operator === '+') return Math.abs(fixDecimal((t2 + t1) / 1000));
  // subtract
  return Math.abs(fixDecimal((t2 - t1) / 1000));
}

/**
 * Search text for swear words.
 * @param {string} text -words checked for swear words.
 * @returns boolean (true|false)
 */
function containsSwearWords(text) {
  const pattern = swearWords.join('|');
  const regex = new RegExp(`\\b(?:${pattern})\\b`, 'i'); // 'i' flag for case-insensitive matching
  if (regex.test(text) || /!remove!/.test(text)) return true;
  return false;
}

/**
 * File deletion.
 * @param {string[]} files File names to be deleted.
 */
function deleteFiles(files, ws) {
  ws.write(`Deleting files: ${files.join(', ')}\n`);
  for (const file of files) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log('\x1b[34m', `${file} was deleted`);
      console.log('\x1b[0m', '');
      ws.write(`${file} was deleted\n`);
    } else {
      console.log('\x1b[34m', `File ${file} was not found!`);
      console.log('\x1b[0m', '');
      ws.write(`File ${file} was not found!\n`);
    }
  }
}

/**
 * Extracts subtitles from video.
 * The function is called when no subtitle is found. It tries to extract subtitle from video. If unsuccessful, calls transcribeVideo function.
 * @param {string} video Video name and extension.
 * @param {string} subName output name of subtitle
 * @param {number} subNumber location of where subtitle is found.
 * @returns boolean. If false, transcribeVideo will be called.
 */
async function extractSubtitle(state) {
  const { video, args, subName, ws } = state;
  // prettier-ignore
  const ffmpegArgs = [
    '-hide_banner',
    '-v', 'error',
    '-i', video,
      // subtitle number. Default is first subtitles.
      '-map', `0:s:${args['subtitle-number'] ? args['subtitle-number'] : 0}`,
      subName
    ]
  console.log('\x1b[34m', `Could not find Subtitle. Trying to Extract ${subName}`);
  console.log('\x1b[0m', '');
  ws.write(`Could not find subtitle ${subName}. Trying to extract from ${video}.\n\n`);
  try {
    // will reject if no subtitle found.
    const stdout = await spawnShell('ffmpeg', ffmpegArgs, ws);
    ws.write(`extractSubtitles:\nstdout: ${stdout}\n\n`);
    console.log('\x1b[34m', `Extracted ${subName}`);
    console.log('\x1b[0m', '');
    ws.write(`Extracted ${subName} from ${video}`);
    return true;
  } catch (error) {
    console.log('No srt found!', error);
    ws.write(`No srt found! ${error}\n\n`);
    return false;
  }
}

/**
 * Because JavaScript math can return precision floating point numbers, this corrects the float to the third decimal point.
 * pass in a number after performing math operation. Fixes float to the third decimal point.
 * @param {float} num float
 * @returns float: same number, corrected to third decimal point.
 */
function fixDecimal(num) {
  return +(Math.round(num + 'e+3') + 'e-3');
}

/**
 * Drop marked frames and Re-encode video.
 * FFmpeg compares each frame number to see if it is 'between' the two numbers.
 * The FFmpeg 'between' function acts as a filter. It compares the current frame time, and the between(start, stop). If number is 'between' the two numbers(inclusive), frame is passed to encoder.
 * @param {string} name Video name without extension.
 * @param {string} ext Video extension.
 * @param {string[]} cuts  Video remove sections. {start, end}.
 * @returns Clean video name.
 */
async function filterGraphAndEncode(state, keeps = []) {
  const {
    sanitizedVideoName,
    sanitizedReEncodeName,
    args,
    cleanVideoName,
    cleanSubName,
    transcribeVideo,
    ws,
  } = state;
  // select frames was taken from: https://github.com/rooty0/ffmpeg_video_cutter/tree/master
  const isGPU = !args.cpu;
  const q = args['re-encode'] ? '22' : args.quality ? args.quality : '24';
  // const bitRate = args['bit-rate'] ? args['bit-rate'] : '128k';
  // prettier-ignore
  const gpu = [
    '-threads', 1,
    '-hwaccel', 'nvdec',
    '-hwaccel_device', 0, // choose first gpu.
    '-hwaccel_output_format', 'cuda'
  ]
  const tenBit = ['-profile:v', 'main10', '-pix_fmt', 'p010le'];
  const gpuEncoderTenBit = ['-c:v', 'hevc_nvenc'];
  const gpuEncoderEightBit = ['-c:v', 'h264_nvenc'];
  // prettier-ignore
  const gpuEncoder = [
    ...(args['10-bit'] ? gpuEncoderTenBit : gpuEncoderEightBit),
    '-gpu:v', 0,
    '-cq:v', q,
    '-rc:v', 'vbr',
    '-tune:v', 'll',
    '-preset:v', 'p1',
    '-b:v', 0,
    '-maxrate:v', '5000k',
    '-bufsize:v', '5000k',
    ...(args['10-bit'] ? tenBit : '')
  ]
  const cpuEncoder = ['-c:v', 'libx264', '-crf', q];
  const subTitleExist = fs.existsSync(cleanSubName) && !args['re-encode'];
  const subTitleName = ['-i', cleanSubName];
  const subTitleMeta = ['-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng'];
  // prettier-ignore
  const videoCuts = [
    '-vf', `select='${keeps.join('+')}', setpts=N/FRAME_RATE/TB`,
    '-af', `aselect='${keeps.join('+')}', asetpts=N/SAMPLE_RATE/TB`,
  ]
  // prettier-ignore
  const filterGraphArgs = [
    '-y',
    args.report ? '-report': '', // turn on ffmpeg logging.
    '-hide_banner',
    '-v', 'error', '-stats',
    ...(isGPU && !args['10-bit'] ? gpu : ''),
    '-i', sanitizedVideoName,
    ...(subTitleExist ? subTitleName : ''),
    ...(!transcribeVideo && !args['re-encode'] ? videoCuts : ''),
    ...(isGPU ? gpuEncoder : cpuEncoder),
    '-c:a', 'ac3',
    '-b:a', '160k',
    ...(subTitleExist ? subTitleMeta : ''),
    args['re-encode'] ? sanitizedReEncodeName : cleanVideoName
  ]

  const stdout = await spawnShell(
    'ffmpeg',
    filterGraphArgs.filter((a) => a !== ''),
    ws
  );
  ws.write(`filterGraphAndEncode:\nstdout: ${stdout}\n\n`);
  // log clean video metadata.
  await getVideoMetadata(args['re-encode'] ? sanitizedReEncodeName : cleanVideoName, ws);
  return;
}

/**
 * Convert cmd line arguments into an object.
 * @returns object: { key1: value, key2: value }
 *  -if argument passed without value, value will be true.
 */
function getArgs() {
  // arguments.
  const args = Object.fromEntries(
    process.argv
      .slice(2)
      .join(' ')
      .split(/ -{1,2}/)
      .map((arg) => {
        // console.log('arg', arg);
        const kv = arg
          .trim()
          .toLowerCase()
          .replace(/^-{1,2}/, '')
          .split(/\s|=/);
        // console.log('kv', kv);
        if (kv.length < 2) kv.push(true);
        return kv;
      })
      .filter((arg) => !!arg[0])
  );
  return args;
}

/**
 * Use subtitles file to find swear words, and timestamps. Create video slice timestamps and clean subtitles file.
 * @param {string} video Video name and extension.
 * @param {string} srtFile Name of subtitle file.
 * @returns video cut points array.
 */
async function getCuts(state) {
  const { name, args, ext, subName, cleanSubName, ws } = state;
  // turn subtitles into string[].
  const subtitles = splitSubtitles(subName, ws);

  // new srt.
  const newSrtArr = [];
  // track cut words
  const cutTxtArr = [];
  // keep track of cut time for subtitle alignment.
  let totalSecondsRemoved = 0;
  // debug
  let keepStr = '';
  // invert cuts
  const keeps = [];
  let s = 0;
  for (const [i, sub] of subtitles.entries()) {
    const { id, start, end, text } = sub;
    const startSeconds = Math.floor(timeToSeconds(start));
    const endSeconds = Math.ceil(timeToSeconds(end));
    if (containsSwearWords(text)) {
      // invert cuts.
      if (startSeconds === 0) {
        // jump to next endSeconds.
        s = endSeconds;
        const secRemoved = Math.abs(endSeconds - startSeconds);
        totalSecondsRemoved += secRemoved;
        keepStr += `Start time was zero. Seconds removed: ${secRemoved}.\t`;
      } else {
        // ignore clips shorter than two seconds.
        if (Math.abs(startSeconds - s) >= 2) {
          const between = `between(t,${s},${startSeconds})`;
          keeps.push(between);
          const secRemoved = Math.abs(endSeconds - startSeconds);
          totalSecondsRemoved += secRemoved;
          keepStr += `${between}\tSecondsRemoved: ${secRemoved}\t`;
        } else {
          const secRemoved = Math.abs(endSeconds - s);
          totalSecondsRemoved += secRemoved;
          // log
          keepStr += `Time was less than two seconds! Skipping!\t\tSecondsRemoved: ${secRemoved}\t`;
        }
        s = endSeconds;
      }
      // save timestamp of cut words.
      cutTxtArr.push({ id, start, end, text });
    } else {
      // no swear words in line.
      // Fix subtitle times to align with cut movie.
      const startFix = secondsToTime(addSubtractSec('-', timeToSeconds(start), totalSecondsRemoved));
      const endFix = secondsToTime(addSubtractSec('-', timeToSeconds(end), totalSecondsRemoved));
      // push clean srt.
      newSrtArr.push({ id, start: startFix, end: endFix, text });
    }

    // to debug time scale.
    keepStr += `index: ${i}, \tid: ${id}\ts: ${s},\tstart: ${startSeconds}s, ${start}\tend: ${endSeconds}s, ${end}\t\tTotalSecondsRemoved: ${totalSecondsRemoved}s.\n`;
  }
  // push to end of video
  const duration = await getVideoDuration(name, ext, ws);
  if (s < duration) keeps.push(`between(t,${s},${duration})`);

  // print between times when debug.
  ws.write(`getCuts: -keepStr. This logs the time removed from subtitles.\n${keepStr}\n\n`);

  // create new srt file.
  const cleanSubtitleStr = newSrtArr
    .map((b, idx) => ({ ...b, id: idx + 1 })) // fix id
    .reduce((acc, cur) => {
      const { id, start, end, text } = cur;
      return (acc += `${id}
${start} --> ${end}
${text}

`);
    }, '');
  // write the clean subtitles. -when just re-encoding video to fix bad frames, no subtitles needed.
  if (!args['re-encode']) fs.writeFileSync(cleanSubName, cleanSubtitleStr);
  ws.write(`${cleanSubName}\n${cleanSubtitleStr}\n\n`);

  // Create string of cut words.
  const swearWordsTxt = cutTxtArr.reduce((acc, cur) => {
    const { id, start, end, text } = cur;
    return (acc += `${start} - ${end} \t${text.trim().replace(/\r?\n/g, ' ')}\n`);
  }, '');
  // log
  ws.write(`getCuts: -Swear Words\n${swearWordsTxt}\n\n`);
  return keeps;
}

/**
 * Split video name and extension.
 * @param {string} name video name and extension.
 * @returns object: { name: string, ext: string }
 */
function getName(name) {
  const videoName = name.split('.');
  const ext = videoName.pop();
  // video name may have more than one decimal in name.
  return { name: videoName.join('.'), ext };
}

/**
 * Use ffprobe to extract video seconds.milliseconds from metadata.
 * @param {string} video name including extension.
 * @returns string. time in sec.milli
 */
async function getVideoDuration(name, ext, ws) {
  // MKV containers do not write duration to header. Must use 'format' option.
  const isMKV = ext === 'mkv';
  // prettier-ignore
  const durationArgs = [
    '-v', 'error',
    '-hide_banner',
    '-print_format', 'flat',
    '-show_entries',  isMKV ? 'format=duration' : 'stream=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    '-select_streams', 'v:0',
    `${name}.${ext}`
  ]
  let duration = await spawnShell('ffprobe', durationArgs, ws);
  duration = +duration.trim();
  ws.write(`Video Length: Sec.Milli: ${duration}, Time: ${secondsToTime(duration)}\n\n`);
  return duration;
}

/**
 * FFprobe to get the Video metadata. Record to log file.
 * @param {string} video name of video
 * @param {object} ws writeStream
 * @returns undefined
 */
async function getVideoMetadata(video, ws) {
  try {
    const metadataArgs = ['-hide_banner', '-i', video];
    const stdout = await spawnShell('ffprobe', metadataArgs, ws);
    ws.write(`${video} Metadata\n${stdout}\n\n`);
    return;
  } catch (error) {
    ws.write(`getVideoMetadata Error: ${error}\n\n`);
    throw new Error(error);
  }
}

/**
 * Filter list of files for video type, and remove temporary videos from list.
 * @returns string[]: List of video names.
 */
function getVideoNames() {
  // filter for common video types.
  const vidext = ['\\.mp4$', '\\.mkv$', '\\.avi$', '\\.webm$'];
  const extRegex = new RegExp(vidext.join('|'));
  // filter out videos made from the program.
  const avoidVideos = ['output', 'clean', 'temp', 'sanitize', 're-encode'];
  // create video list, filtering videos.
  const avoidRegex = new RegExp(avoidVideos.map((a) => vidext.map((v) => `${a}${v}`).join('|')).join('|'));
  // console.log('regex', avoidRegex);
  const videos = fs
    .readdirSync(process.cwd())
    .filter((file) => extRegex.test(file))
    .filter((file) => !avoidRegex.test(file));
  console.log(videos);
  return videos;
}

/**
 * Copy only audio and video to remove subtitles, extra audio.
 * @param {string} name Video name without extension
 * @param {string} ext Video extension
 * @returns string: sanitizeVideoName
 */
async function sanitizeVideo(state) {
  const { name, ext, args, sanitizedVideoName, ws } = state;
  // prettier-ignore
  const sanitizeArgs = [
    '-y',
    '-hide_banner',
    '-v', 'error', '-stats',
    '-i', `${name}.${ext}`,
    '-c:v', 'copy',
    '-c:a', 'copy',
    '-sn',
    '-map_metadata', '-1', // remove existing metadata.
    '-metadata', `creation_time=${new Date().toISOString()}`,
    '-metadata',`title="${name}.mp4"`,
    '-map', '0:v', // copy all video streams.
    // copy all audio streams(default), or choose single audio stream.
    '-map', `0:a${args['audio-number'] ? ':' +args['audio-number'] : ''}`,
    sanitizedVideoName
  ]
  // default remove chapters
  if (!args.chapters) sanitizeArgs.splice(-1, 0, '-map_chapters', '-1');

  const stdout = await spawnShell('ffmpeg', sanitizeArgs, ws);
  ws.write(`sanitizeVideo:\nstdout: ${stdout}\n\n`);
  // log new video metadata.
  await getVideoMetadata(sanitizedVideoName, ws);
  return;
}

/**
 * Convert seconds,milli back to Time.
 * @param {number} time Time in seconds and milliseconds
 * @returns string. '00:00:00,000'
 */
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
  return `${hourStr}:${minuteStr}:${secStr},${milliStr}`;
}

/**
 * Run OS programs from Nodejs environment.
 * @param {string} command bash command of program
 * @param {array} spawnArgs array of arguments. -No spaces. Must be comma separated.
 * @returns string, stdout
 */
async function spawnShell(command, spawnArgs = [], ws) {
  const { spawn } = require('child_process');
  return new Promise((resolve, reject) => {
    let stdout = '';
    try {
      const msg = `Running command: ${command} ${spawnArgs.join(' ')}\n\n`;
      ws.write(msg);
      console.log(msg);
      const process = spawn(command, spawnArgs);
      process.stdout.on('data', (data) => {
        console.log(data.toString());
        stdout += data;
      });
      process.stderr.on('data', (data) => {
        console.log(data.toString());
        stdout += data;
      });
      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          const error = new Error(`Command "${command} ${spawnArgs.join(' ')}" exited with code ${code}`);
          error.code = code;
          error.stdout = stdout;
          ws.write(
            `Error: Command "${command} ${spawnArgs.join(' ')}" exited with code ${code}.\n${stdout}\n\n`
          );
          reject(error);
        }
      });
      process.on('error', (error) => {
        ws.write(error.toString());
        reject(error);
      });
    } catch (error) {
      // prettier-ignore
      ws.write(`Error: Command "${command} ${spawnArgs.join(' ')}" exited with error.\nSTDOUT: ${stdout}\nERROR: ${e}\n\n`);
      reject(error);
    }
  });
}

/**
 *
 * @param {string} subTitleName subTitle name
 * @param {object} ws writeStream
 * @returns string[] each timestamp separated into sections.
 */
function splitSubtitles(subTitleName, ws) {
  const srt = fs.readFileSync(subTitleName, 'utf-8');
  // read srt, split into blocks. -convert to object.
  const subtitles = srt.split(/\r?\n\r?\n\d{1,5}\r?\n?$/m).map((block, idx) => {
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
      id: idx + 1,
      start,
      end,
      text: text.join('\n').trim(),
    };
  });

  const subStr = subtitles.reduce((acc, cur) => {
    const { id, start, end, text } = cur;
    return (acc += `${id}\n${start} --> ${end}\n${text}\n\n`);
  }, '');

  ws.write(`splitSubtitles:\n${subStr}\n\n`);
  return subtitles;
}

/**
 * Convert time as string into seconds.milliseconds
 * @param {string} time '00:00:00,000' hour : minute : second, millisecond
 * @returns number. decimal to 3 places.
 */
function timeToSeconds(time) {
  if (!time) return '';
  const [hour, min, sec, milli = 0] = time.split(/:|,/);
  // console.log(time, hour, min, sec, milli);
  const totalSec = +hour * 60 * 60 + +min * 60 + +sec;
  return +`${totalSec}.${milli}`;
}

/**
 * Docker must be running. Pulls the Video-Swear-Jar image. AI transcribes the audio to text and outputs a clean version of video.
 * // https://github.com/jveldboom/video-swear-jar
 * @param {string} video Video name and extension.
 * @returns object: { stdout: string stderr: string }
 */
async function transcribeVideo(state) {
  const { video, ws } = state;
  const msg = `Could not extract subtitles from ${video}.\nStarting Docker with AI transcription.\nThis will take a few minutes to transcribe video.\n\n`;
  ws.write(msg);
  console.log('\x1b[35m', msg);
  console.log('\x1b[0m', '');
  // prettier-ignore
  const dockerArgs = [
      'run', '--rm',
      '-v', `${process.cwd()}:/data`,
      '-v', `${process.cwd()}/.whisper:/app/.whisper`, 'jveldboom/video-swear-jar:v1',
      'clean',
      '--input', video,
      '--model', 'tiny.en',
      '--language', 'en',
    ]
  const stdout = await spawnShell('docker', dockerArgs, ws);
  ws.write(`transcribeVideo:\nstdout: ${stdout}\n\n`);
  return;
}

module.exports = {
  containsSwearWords,
  deleteFiles,
  extractSubtitle,
  filterGraphAndEncode,
  getArgs,
  getCuts,
  getName,
  getVideoDuration,
  getVideoMetadata,
  getVideoNames,
  sanitizeVideo,
  spawnShell,
  transcribeVideo,
};
