(async function () {
  const fs = require('fs');
  const {
    deleteFiles,
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

    // create state object to pass around.
    const state = {
      args,
      video,
      name,
      ext,
      logName,
      subName: `${name}.srt`,
      sanitizedVideoName: `${name}-sanitize.${ext}`,
      outputVideoName: `${name}-output.${ext}`,
      cleanSubName: `${name}-clean.srt`,
      cleanVideoName: `${name}-clean.mp4`,
      transcribeVideo: false,
      ws,
    };
    // log original video metadata.
    await getVideoMetadata(state.video, ws);

    // check for srt file. if not found, try to extract it.
    if (!fs.existsSync(state.subName)) {
      const subExist = await extractSubtitle(state);
      // if no subtitle found, use AI to transcribe video.
      if (!subExist) {
        state.transcribeVideo = true;
        // creates video with '-output' in name.
        const out = await transcribeVideo(state);
        // returns string only if no swear words.
        console.log('out', out);

        // check if there are swear words.
        if (/No swear words found/.test(out?.stdout || '')) {
          console.log('\x1b[35m', 'Transcription done! No swear words found.');
          console.log('\x1b[0m', '');
          ws.write('Transcription done! No swear words found.\n\n');
          continue;
        }
        // fix video name
        state.video = `${state.name}-output.${state.ext}`;
        // fix cut video with ffmpeg.
        await filterGraphAndEncode(state);
        const removedFiles = [`${name}-cut.txt`, `${name}.json`, state.video, `${name}-cut-words.txt`];
        if (!args.debug) deleteFiles(removedFiles, state.ws);
        continue;
      }
    } else {
      ws.write(`Subtitle ${state.subName} found!\n\n`);
    }

    // remove everything but audio and video.
    // Why? FilterGraph will keep the embedded subtitle and not add the timestamp corrected subtitle.
    await sanitizeVideo(state);

    // search subtitles for swear words. Create cleaned subtitles and cut points.
    const keeps = await getCuts(state);

    // encode video from cut points.
    await filterGraphAndEncode(state, keeps);

    // delete working files.
    const deletes = [state.sanitizedVideoName, state.cleanSubName];
    // remove everything but clean video.
    if (args.clean) deletes.push(state.video, state.subName, state.logName);
    // if debug flag is passed, prevent deletion of files.
    if (!args.debug) deleteFiles(deletes, state.ws);
    ws.end();
  }
})();
