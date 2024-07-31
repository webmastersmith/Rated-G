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
    const { name, ext } = getName(video);
    // check for srt file. if not found, try to extract it.
    const subName = `${name}.srt`;
    if (!fs.existsSync(subName)) {
      const subExist = await extractSubtitle(video, subName);
      // if no subtitle found, use AI to transcribe video.
      if (!subExist) {
        const out = await transcribeVideo(video);
        // check if there are swear words.
        if (/No swear words found/.test(out.stdout)) {
          console.log('\x1b[35m', 'Transcription done! No swear words found.');
          console.log('\x1b[0m', '');
          return;
        }
        // encode output video with ffmpeg.
        await encodeVideo(name, `${name}-output.${ext}`);
        const removedFiles = [`${name}-cut.txt`, `${name}.json`, `${name}-output.${ext}`];
        if (!args.debug) deleteFiles(removedFiles);
        return;
      }
    }

    // remove everything but audio and video.
    // Why? FilterGraph will keep the embedded subtitle and not add the timestamp corrected subtitle.
    const sanitizeVideoName = await sanitizeVideo(name, ext);

    // search subtitles for swear words. Create cleaned subtitles and cut points.
    const { swearWordsTxtName, cleanSubtitleName, keeps } = await getCuts(name, ext, subName);
    if (args.debug) console.log('cleanSubtitleName: ', cleanSubtitleName);

    // encode video from cut points.
    await filterGraphAndEncode(sanitizeVideoName, name, ext, keeps, cleanSubtitleName);
    // await filterGraphAndEncode(name, ext, keeps, cleanSubtitleName);

    // delete working files.
    const deletes = [sanitizeVideoName];
    if (args.delete) deletes.push(cleanSubtitleName, swearWordsTxtName, video, subName);
    if (!args.debug) deleteFiles(deletes);
  }
})();
