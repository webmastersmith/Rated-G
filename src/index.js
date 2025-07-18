(async () => {
	const fs = require("node:fs");
	const {
		addSwearWords,
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
		zipVideo,
	} = require("./utils.js");
	const swearWords = require("./swear-words.json");

	const args = getArgs();
	const videos = getVideoNames();

	for (const video of videos) {
		const start = new Date().getTime();
		console.log(video);
		const { name, ext } = getName(video); // ext is lowercased.
		const logName = `${name}.log`;
		const ws = fs.createWriteStream(logName);
		args.clean = args?.zip === true;
		try {
			// log args.
			ws.write(
				`Video Names ------------------------------------\n${videos.join("\n")}\n\n`,
			);
			const videoMeta = await getMetadata(video, args, ws);

			const state = {
				args,
				cleanSubName: `${name}-clean.srt`,
				cleanVideoName: `${name}-clean.mp4`,
				ext,
				name,
				logName,
				subName: `${name}.srt`,
				swearWordString: addSwearWords(swearWords, args?.add?.split(" ") ?? []), // Modify Swear Word list.
				ignoreWords: args?.ignore?.split(" ") ?? [],
				transcribeVideo: false,
				video,
				videoMeta,
			};
			// console.log(state);
			ws.write(
				`State -------------------------------------------\n${JSON.stringify(state, null, 2)}\n\n`,
			);

			// log original video metadata.
			await recordMetadata(state.video, ws);

			// Do not alter content if skip flag is true.
			if (!args?.skip) {
				// check for subtitle file.
				if (fs.existsSync(state.subName)) {
					ws.write(`Subtitle ${state.subName} found!\n\n`);
				} else {
					// subtitle does not exist, try to extract it from video.
					const subExist = await extractSubtitle(state, ws);
					// if no subtitle found, use Video Swear Jar AI to transcribe video.
					if (!subExist) {
						state.args.skip = true;
						// returns string only if no swear words. Creates video with '-output' in name.
						const out = await transcribeVideo(state, ws);
						console.log("out", out);

						// check if there are swear words in the 'transcribeVideo' out message.
						if (/No swear words found/.test(out?.stdout || "")) {
							console.log(
								"\x1b[35m",
								"Transcription done! No swear words found.",
							);
							console.log("\x1b[0m", "");
							ws.write("Transcription done! No swear words found.\n\n");
							const end = new Date().getTime();
							ws.write(
								`Time to Complete ${video}: ${convertMsToTime(end - start)}\n\n`,
							);
							ws.end();
							continue;
						}
						// Change input name. The video created by 'Video-Swear-Jar' has '-output' in name.
						state.video = `${state.name}-output.${state.ext}`;
						// The 'output' video will be cut and missing timestamps. Re-encode to fix.
						await filterGraphAndEncode(state, ws);
						const removedFiles = [
							`${name}-cut.txt`,
							`${name}.json`,
							state.video,
							`${name}-cut-words.txt`,
						];
						if (!args.debug) deleteFiles(removedFiles, ws);
						const end = new Date().getTime();
						ws.write(
							`Time to Complete ${video}: ${convertMsToTime(end - start)}\n\n`,
						);
						ws.end();
						// jump to next video.
						continue;
					}
				} // end srt found!
			}

			// Get video/audio cut times from subtitle swear words.
			// Create cleaned subtitle with corrected timestamps.
			// const timeStamps = {keeps: [], blurs:[]};
			const timeStamps =
				args?.skip || args?.copy
					? { keeps: [], blurs: [] }
					: await getCuts(state, ws);
			ws.write(`TimeStamps:\n${JSON.stringify(timeStamps)}\n\n`);

			// Cut video/audio and re-encode.
			await filterGraphAndEncode(state, ws, timeStamps);

			if (args?.zip) await zipVideo(state, ws);

			// delete working files.
			const deletes = [state.cleanSubName];
			// remove everything but clean video.
			if (args?.clean) deletes.push(state.video, state.subName, "clean.txt");
			if (args?.["clean-all"])
				deletes.push(state.video, state.subName, state.logName);
			// if debug flag is passed, prevent deletion of files.
			if (!args?.debug) deleteFiles(deletes, ws);
			const end = new Date().getTime();
			ws.write(
				`Time to Complete ${video}: ${convertMsToTime(end - start)}\n\n`,
			);
			ws.end();
		} catch (err) {
			ws.end();
			// allow writes to finish before closing program.
			ws.on("close", () => {
				throw new Error(err);
			});
		}
	} // end for loop
})();
