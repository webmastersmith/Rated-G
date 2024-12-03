(async function () {
  const fs = require('fs');
  const {
    convertMsToTime,
    deleteFiles,
    extractSubtitle,
    filterGraphAndEncode,
    getArgs,
    getCuts,
    getName,
    getMetadata,
    getVideoNames,
    recordMetadata,
    transcribeVideo,
  } = require('./utils.js');

  const args = getArgs();
  const videos = getVideoNames();

  for (const video of videos) {
    const start = new Date().getTime();
    console.log(video);
    const { name, ext } = getName(video);
    const logName = `${name}.log`;
    const ws = fs.createWriteStream(logName);
    try {
      // log args.
      ws.write(`Video Names ------------------------------------\n${videos.join('\n')}\n\n`);
      const videoMeta = await getMetadata(video, args, ws);

      const state = {
        args,
        cleanSubName: `${name}-clean.srt`,
        cleanVideoName: `${name}-clean.mp4`,
        ext,
        name,
        logName,
        subName: `${name}.srt`,
        transcribeVideo: false,
        video,
        videoMeta,
      };
      // console.log(state);
      ws.write(`State -------------------------------------------\n${JSON.stringify(state, null, 2)}\n\n`);

      // log original video metadata.
      await recordMetadata(state.video, ws);

      // check for subtitle file. if not found, try to extract it.
      if (!fs.existsSync(state.subName)) {
        const subExist = await extractSubtitle(state, ws);
        // if no subtitle found, use AI to transcribe video.
        if (!subExist) {
          state.args.skip = true;
          // returns string only if no swear words.
          // creates video with '-output' in name.
          const out = await transcribeVideo(state, ws);
          console.log('out', out);

          // check if there are swear words.
          if (/No swear words found/.test(out?.stdout || '')) {
            console.log('\x1b[35m', 'Transcription done! No swear words found.');
            console.log('\x1b[0m', '');
            ws.write('Transcription done! No swear words found.\n\n');
            continue;
          }
          // The video created by 'Video-Swear-Jar' has '-output' in name.
          state.video = `${state.name}-output.${state.ext}`;
          // fix cut video with ffmpeg.
          await filterGraphAndEncode(state, ws);
          await recordMetadata(state.cleanVideoName, ws);
          const removedFiles = [`${name}-cut.txt`, `${name}.json`, state.video, `${name}-cut-words.txt`];
          if (!args.debug) deleteFiles(removedFiles, ws);
          const end = new Date().getTime();
          ws.write(`Time to Complete ${video}: ${convertMsToTime(end - start)}\n\n`);
          ws.end();
          // jump to next video.
          continue;
        }
      } else {
        ws.write(`Subtitle ${state.subName} found!\n\n`);
      }

      // Get video/audio cut times from subtitle swear words.
      // Create cleaned subtitle with corrected timestamps.
      const keeps = await getCuts(state, ws);

      // Cut video/audio and re-encode.
      await filterGraphAndEncode(state, ws, keeps);
      // record specs of clean video.
      await recordMetadata(state.cleanVideoName, ws);

      // delete working files.
      const deletes = [state.cleanSubName];
      // remove everything but clean video.
      if (args?.clean) deletes.push(state.video, state.subName);
      if (args?.['clean-all']) deletes.push(state.video, state.subName, state.logName);
      // if debug flag is passed, prevent deletion of files.
      if (!args?.debug) deleteFiles(deletes, ws);
      const end = new Date().getTime();
      ws.write(`Time to Complete ${video}: ${convertMsToTime(end - start)}\n\n`);
      ws.end();
    } catch (err) {
      ws.end();
      // allow writes to finish before closing program.
      ws.on('close', () => {
        throw new Error(err);
      });
    }
  } // end for loop
})();
