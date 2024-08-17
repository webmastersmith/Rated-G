(async function () {
  const fs = require('fs');
  const {
    deleteFiles,
    encodeVideo,
    extractSubtitle,
    filterGraphAndEncode,
    getArgs,
    getCuts,
    getName,
    getVideoMetadata,
    getVideoNames,
    sanitizeVideo,
    transcribeVideo,
  } = require('./utils');

  const args = getArgs();
  const videos = getVideoNames();

  for (const video of videos) {
    console.log(video);
    const { name, ext } = getName(video);
    const logName = `${name}.log`;
    const ws = fs.createWriteStream(logName);
    ws.write(`getArgs:\nprocess.argv: ${JSON.stringify(process.argv)}\nargs: ${JSON.stringify(args)}\n\n`);
    ws.write(`getVideoNames:\n${videos.join('\n')}\n\n`);

    // log original video metadata.
    await getVideoMetadata(video, ws);

    // check for srt file. if not found, try to extract it.
    const subName = `${name}.srt`;
    if (!fs.existsSync(subName)) {
      const subExist = await extractSubtitle(video, subName, ws);
      // if no subtitle found, use AI to transcribe video.
      if (!subExist) {
        const out = await transcribeVideo(video, ws);
        // check if there are swear words.
        if (/No swear words found/.test(out.stdout)) {
          console.log('\x1b[35m', 'Transcription done! No swear words found.');
          console.log('\x1b[0m', '');
          ws.write('Transcription done! No swear words found.\n\n');
          return;
        }
        // encode output video with ffmpeg.
        await encodeVideo(name, `${name}-output.${ext}`, ws);
        const removedFiles = [`${name}-cut.txt`, `${name}.json`, `${name}-output.${ext}`];
        if (!args.debug) deleteFiles(removedFiles);
        return;
      }
    } else {
      ws.write(`Subtitle ${name}.srt found!\n\n`);
    }

    // remove everything but audio and video.
    // Why? FilterGraph will keep the embedded subtitle and not add the timestamp corrected subtitle.
    const sanitizeVideoName = await sanitizeVideo(name, ext, ws);

    // search subtitles for swear words. Create cleaned subtitles and cut points.
    const { cleanSubtitleName, keeps } = await getCuts(name, ext, subName, ws);

    // encode video from cut points.
    await filterGraphAndEncode(sanitizeVideoName, name, ext, keeps, ws, cleanSubtitleName);
    // await filterGraphAndEncode(name, ext, keeps, cleanSubtitleName);

    // delete working files.
    const deletes = [sanitizeVideoName, cleanSubtitleName];
    // remove everything but clean video.
    if (args.clean) deletes.push(video, subName, logName);
    // if debug flag is passed, prevent deletion of files.
    if (!args.debug) deleteFiles(deletes);
    ws.end();
  }
})();
