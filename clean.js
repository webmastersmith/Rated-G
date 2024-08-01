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
    if (args.debug) {
      ws.write(`getArgs:\nprocess.argv: ${JSON.stringify(process.argv)}\nargs: ${JSON.stringify(args)}\n\n`);
      ws.write(`getVideoNames:\n${videos.join('\n')}\n\n`);
    }
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
          return;
        }
        // encode output video with ffmpeg.
        await encodeVideo(name, `${name}-output.${ext}`, ws);
        const removedFiles = [`${name}-cut.txt`, `${name}.json`, `${name}-output.${ext}`];
        if (!args.debug) deleteFiles(removedFiles);
        return;
      }
    }

    // remove everything but audio and video.
    // Why? FilterGraph will keep the embedded subtitle and not add the timestamp corrected subtitle.
    const sanitizeVideoName = await sanitizeVideo(name, ext, ws);

    // search subtitles for swear words. Create cleaned subtitles and cut points.
    const { swearWordsTxtName, cleanSubtitleName, keeps } = await getCuts(name, ext, subName, ws);

    // encode video from cut points.
    await filterGraphAndEncode(sanitizeVideoName, name, ext, keeps, ws, cleanSubtitleName);
    // await filterGraphAndEncode(name, ext, keeps, cleanSubtitleName);

    // delete working files.
    const deletes = [sanitizeVideoName, logName];
    if (args.clean) deletes.push(cleanSubtitleName, swearWordsTxtName, video, subName);
    if (!args.debug) deleteFiles(deletes);
    if (args.debug) ws.end();
  }
})();
