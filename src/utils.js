const { time } = require("node:console");
const fs = require("node:fs");

/**
 * Add SwearWords to list.
 * @param {string[]} words array of strings to add to swearWords list.
 */
function addSwearWords(_swearWords, _newSwearWords = []) {
	// if not an array, create array.
	const newSwearWords = !Array.isArray(_newSwearWords)
		? _newSwearWords.split(" ")
		: _newSwearWords;
	const swearWords = _swearWords.concat(newSwearWords);
	return swearWords.join("|");
}

/**
 * Subtract or add floats.
 * @param {string} operator +|-
 * @param {float} sec1 Seconds.milliseconds
 * @param {float} sec2 Seconds.milliseconds
 * @returns float. seconds.milliseconds to third decimal place.
 */
function addSubtractSec(operator, sec1, sec2) {
	const t1 = fixDecimal(sec1 * 1000);
	const t2 = fixDecimal(sec2 * 1000);
	// add
	if (operator === "+") return Math.abs(fixDecimal((t2 + t1) / 1000));
	// subtract
	return Math.abs(fixDecimal((t2 - t1) / 1000));
}

/**
 * Search text for swear words.
 * @param {string} text -words checked for swear words.
 * @returns boolean (true|false)
 */
function containsSwearWords(state, text) {
	const { swearWordString, ignoreWords } = state;
	const swearWordRegex = new RegExp(`\\b(?:${swearWordString})\\b`, "iu");
	// if text includes 'ignore word' -not a swear word.
	if (
		ignoreWords.some((ignoreWord) =>
			new RegExp(`\\b${ignoreWord}\\b`, "i").test(text),
		)
	)
		return false;
	if (text.includes("!ignore!")) return false;
	if (swearWordRegex.test(text) || /!remove!/.test(text)) return true;
	return false;
}

function convertMsToTime(milliseconds) {
	function padTo2Digits(num) {
		return num.toString().padStart(2, "0");
	}
	let seconds = Math.floor(milliseconds / 1000);
	let minutes = Math.floor(seconds / 60);
	let hours = Math.floor(minutes / 60);
	seconds = seconds % 60;
	minutes = minutes % 60;
	// 👇️ If you don't want to roll hours over, e.g. 24 to 00
	// 👇️ comment (or remove) the line below
	// commenting next line gets you `24:00:00` instead of `00:00:00`
	// or `36:15:31` instead of `12:15:31`, etc.
	hours = hours % 24;
	return `${padTo2Digits(hours)}:${padTo2Digits(minutes)}:${padTo2Digits(seconds)}`;
}

/**
 * File deletion.
 * @param {string[]} files File names to be deleted.
 */
function deleteFiles(files, ws) {
	ws.write(`Deleting files: ${files.join(", ")}\n`);
	for (const file of files) {
		if (fs.existsSync(file)) {
			fs.unlinkSync(file);
			console.log("\x1b[34m", `${file} was deleted`);
			console.log("\x1b[0m", "");
			ws.write(`${file} was deleted\n`);
		} else {
			console.log("\x1b[34m", `File ${file} was not found!`);
			console.log("\x1b[0m", "");
			ws.write(`File ${file} was not found!\n`);
		}
	}
	ws.write("\n\n");
	return;
}

/**
 * Extracts subtitles from video.
 * The function is called when no subtitle is found. It tries to extract subtitle from video. If unsuccessful, calls transcribeVideo function.
 * @param {string} video Video name and extension.
 * @param {string} subName output name of subtitle
 * @param {number} subNumber location of where subtitle is found.
 * @returns boolean. If false, transcribeVideo will be called.
 */
async function extractSubtitle(state, ws) {
	const { video, args, subName } = state;
	// biome-ignore format: no format
	const ffmpegArgs = [
    '-hide_banner',
    '-v', 'error',
    '-i', video,
      // subtitle number. Default is first subtitles.
      '-map', `0:s:${args['subtitle-number'] ? args['subtitle-number'] : 0}`,
      subName
    ]
	console.log(
		"\x1b[34m",
		`Could not find Subtitle. Trying to Extract ${subName}`,
	);
	console.log("\x1b[0m", "");
	ws.write(
		`Could not find subtitle ${subName}. Trying to extract from ${video}.\n\n`,
	);
	try {
		// will reject if no subtitle found.
		const stdout = await spawnShell("ffmpeg", ffmpegArgs, ws);
		ws.write(`extractSubtitles:\nstdout: ${stdout}\n\n`);
		console.log("\x1b[34m", `Extracted ${subName}`);
		console.log("\x1b[0m", "");
		ws.write(`Extracted ${subName} from ${video}`);
		return true;
	} catch (error) {
		console.log("No srt found!", error);
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
	// biome-ignore lint/style/useTemplate:
	return +(Math.round(num + "e+3") + "e-3");
}

/**
 * Drop marked frames and Re-encode video.
 * FFmpeg compares each frame number to see if it is 'between' the two numbers.
 * The FFmpeg 'between' function acts as a filter. It compares the current frame time, and the between(start, stop). If number is 'between' the two numbers(inclusive), frame is passed to encoder.
 * @param {string} state Object.
 * @param {string} ws write stream.
 * @param {string[]} keeps  Video remove sections. {start, end}.
 * @returns Clean video name.
 */
async function filterGraphAndEncode(state, ws, timeStamps) {
	const {
		args,
		ext,
		name,
		subName,
		cleanSubName,
		cleanVideoName,
		video,
		videoMeta,
	} = state;
	const { keeps, blurs } = timeStamps;

	const isGPU = !args?.cpu;
	let q = args?.quality ? +args.quality : 27;
	// check if quality is a number.
	if (Number.isNaN(q)) q = 26;
	const audioNumber = args?.["audio-number"] ? args["audio-number"] : 0;
	// biome-ignore format: no format
	const eightBit = [
    '-pix_fmt',
    'yuv420p',
    '-profile',
    args?.h264 ? 'high' : 'main',
    '-c:v',
    args?.h264 ? 'h264_nvenc' : 'hevc_nvenc',
  ];
	const tenBit = [
		"-pix_fmt",
		"p010le",
		"-profile:v",
		"main10",
		"-c:v",
		"hevc_nvenc",
	];
	// biome-ignore format: Biome formats this into one item per line.
	const gpuEncoder = [
    ...(args?.['10-bit'] ? tenBit : eightBit), // after name, before encoder.
    '-r', videoMeta.frameRate, // keep same frame rate as original.
    // biome-ignore format: no format
    ...(args?.smallest ? ['-preset', 'p7', '-multipass', 2] : ['-preset', 'p1', '-multipass', 0]),
    '-b:v', 0,
    '-bf', 0,
    '-g', 300,
    '-me_range', 36,
    '-subq', 9,
    '-keyint_min', 1,
    '-qdiff', 20,
    '-qcomp', 0.9,
    '-qmin', 17,
    '-qmax', 51,
    '-qp', q,
    '-rc', 'constqp',
    '-tune', 'hq',
    '-rc-lookahead', 4,
    '-keyint_min', 1,
    '-qdiff', 20,
    '-qcomp', 0.9,
  ];
	const cpuEncoder = ["-c:v", args?.h265 ? "libx265" : "libx264", "-crf", q];
	// biome-ignore format: no format
	const audio = [
    '-c:a', videoMeta.audioCodec,
    '-b:a', videoMeta.audioBitRate,
    '-ar', videoMeta.audioSampleRate,
  ];
	// biome-ignore format: no format
	const sanitize = [  
      '-map_metadata', '-1', // remove existing metadata.
      ...(args?.['no-chapters'] ? ['-map_chapters', '-1'] : '') // remove chapter metadata.
  ]
	// biome-ignore format: no format
	const newMetadata = [  
      '-metadata', `creation_time=${new Date().toISOString()}`,
      '-metadata',`title='${name}'`,
  ]
	const subTitleExist = fs.existsSync(cleanSubName);
	const subTitleMeta = [
		"-c:s",
		args?.copy && ext === "mkv" ? "srt" : "mov_text",
		"-metadata:s:s:0",
		"language=eng",
	];

	// if (blurs.length > 0) {
	// 	const inputBlurs = [];
	// 	for (const blurTime of blurs) {
	// 		// create for each blur spot.
	// 		blurBetweens.push();
	// 	}
	// 	// filterComplexBlurs = [
	// 	// 	"-filter_complex",
	// 	// 	`${inputVideo}gblur=sigma=100:enable='${blurBetweens.join("+")}'[fg],split`,
	// 	// ];
	// }

	// Filter_Complex blurs
	// Working Code: -filter_complex "[0:v]gblur=sigma=100:enable='between(t,9,16)+between(t,18,31)',split[b0v][b1v];[b0v]trim=start=0:end=11,setpts=PTS-STARTPTS[0v];[0:a:0]atrim=start=0:end=11,asetpts=PTS-STARTPTS[0a];[b1v]trim=start=14:end=120,setpts=PTS-STARTPTS[1v];[0:a:0]atrim=start=14:end=120,asetpts=PTS-STARTPTS[1a];[0v][0a][1v][1a] concat=n=2:v=1:a=1[outv][outa]" -map [outv] -map [outa] -map 1:s:0 -strict experimental output.mp4
	// 1. To enable multiple blurs, you have to split a new video for each 'trim' input.
	// 2. get 'blurBetweens'
	// 3. get 'pairCount'
	// 4. 'split' videos for each 'trim'.
	const inputVideo = "[0:v]";
	const blurBetweens = blurs.map(
		(blurTime) => `between(t,${blurTime.join(",")})`,
	);

	// Filter_Complex Cuts
	// Create final cut and blur array.
	let finalCuts = ["-map", "0:v", "-map", `0:a:${audioNumber}`];
	if (!args?.skip && keeps.length > 0) {
		// Build the cuts.
		let cuts = "";
		let pairCount = 0;
		let pairs = "";
		for (const [i, [start, end]] of keeps.entries()) {
			cuts += `[b${i}v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[${i}v];[0:a:${audioNumber}]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[${i}a];`;
			// add concat pairs.
			pairs += `[${i}v][${i}a]`;
			// count pairs.
			pairCount++;
		}

		// All filterGraph Cuts
		// biome-ignore format: no format
		finalCuts = [
			'-filter_complex',
			`${cuts}${pairs} concat=n=${pairCount}:v=1:a=1[outv][outa]`,
			'-map', '[outv]', '-map', '[outa]'
		];
		// If blurBetweens then create blurs and cuts.
		if (blurBetweens.length > 0) {
			// extract 'trims' to avoid space the 'spawnShell' adds to command.
			const cutBlock = finalCuts.splice(1, 1); // returns `${cuts}${pairs} concat...`
			// This creates the 'split' for each 'trim', otherwise multiple blurs will not work.
			const splits = [];
			for (let i = 0; i < pairCount; i++) {
				splits.push(`[b${i}v]`);
			}
			// Add blurs and cuts back to 'finalCuts'.
			finalCuts.splice(
				1,
				0,
				`${inputVideo}gblur=sigma=100:enable='${blurBetweens.join("+")}',split=${pairCount}${splits.join("")};${cutBlock}`,
			);
		}

		// no longer used.
		// // video-filter. Cuts ~30 or more can cause sync issues.
		// if (args?.["video-filter"]) {
		// 	const betweens = keeps.map(([s, e]) => `between(t,${s},${e})`);
		// 	// biome-ignore format: no format
		// 	filterComplexCuts =[
		//     '-vf', `select='${betweens.join('+')}', setpts=N/FRAME_RATE/TB`,
		//     '-af', `aselect='${betweens.join('+')}', asetpts=N/SAMPLE_RATE/TB`,
		//   ]
		// }
	}

	// Run these ffmpeg commands to cut and embed subtitles into movie.
	// biome-ignore format: no format
	const filterGraphArgs = [
    '-y',
    args?.report ? '-report': '', // turn on ffmpeg logging.
    '-hide_banner',
    '-v', 'error', '-stats',
    ...(isGPU ? ['-hwaccel', 'cuda'] : ''), // before input video
    '-i', video,
    ...(subTitleExist ? ['-i', cleanSubName] : ''),
    ...(isGPU ? gpuEncoder : cpuEncoder), // after input video and subtitle
    ...(subTitleExist ? subTitleMeta : ''),
    ...audio,
    ...sanitize,
    ...newMetadata,
    ...finalCuts,
    ...(subTitleExist && !args?.['video-filter'] ? ['-map', '1:s:0'] : ''),
    ...(args?.audioExperimental ? ['-strict', 'experimental'] : []),
    cleanVideoName
  ]

	// Run these ffmpeg commands if just want to embed subtitles into movie.
	// biome-ignore format: no format
	const copyArgs = [
      '-y',
      args?.report ? '-report': '', // turn on ffmpeg logging.
      '-hide_banner',
      '-v', 'error', '-stats',
      '-i', video,
      ...(ext === 'mkv' ? ['-f', 'srt'] : ''), // mkv and mp4 have different codecs for writing subtitles.
      '-i', subName,
      ...(ext === 'mkv' ? ['-map', '0:0', '-map', '0:1', '-map', '1:0'] : ''),
      '-c:v', 'copy', '-c:a', 'copy',
      ...sanitize,
      ...newMetadata,
      ...subTitleMeta,
      `${name}-withSubtitle.${ext}`
    ]
	const stdout = await spawnShell(
		"ffmpeg",
		args?.copy
			? copyArgs.filter((a) => a !== "")
			: filterGraphArgs.filter((a) => a !== ""),
		ws,
	);

	ws.write(
		`filterGraphAndEncode: --------------------------------------------------\n${stdout}\n\n`,
	);
	// record specs of clean video.
	args?.copy
		? await recordMetadata(`${name}-withSubtitle.${ext}`, ws)
		: await recordMetadata(state.cleanVideoName, ws);
	return;
}

/**
 * Write video metadata to log.
 * @param {string} name name of video
 * @param {function} ws write logs
 * @returns
 */
async function recordMetadata(name, ws) {
	// biome-ignore format: no format
	const options = [
    '-hide_banner',
    '-show_format',
    '-show_streams',
    '-of','json',
    name,
  ];
	const specs = await spawnShell("ffprobe", options, ws, false);
	ws.write(
		`Video ${name} Specifications ----------------------------------\n${specs}\n\n`,
	);
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
			.join(" ")
			.split(/ -{1,2}/)
			.map((arg) => {
				console.log("arg", arg);
				const kv = arg
					.trim()
					.toLowerCase()
					.replace(/^-{1,2}/, "")
					.split(/=/);
				// console.log('kv', kv);
				if (kv.length < 2) kv.push(true);
				return kv;
			})
			.filter((arg) => !!arg[0]),
	);
	return args;
}

/**
 * Use subtitles file to find swear words, and timestamps. Create video slice timestamps and clean subtitles file.
 * Create blur times and return.
 * @param {string} video Video name and extension.
 * @param {string} srtFile Name of subtitle file.
 * @returns video cut points array.
 */
async function getCuts(state, ws) {
	const { name, args, ext, frameRate, subName, cleanSubName, videoMeta } =
		state;
	// turn subtitles into string[].
	const subtitlesAll = splitSubtitles(subName, ws);
	ws.write(
		"Swear Words Keeps ----------------------------------------------\n\tSRT Time\tSeconds\tFrame\n",
	);

	// move blurred timestamps to their own array.
	const blurs = []; // [ 100, 500 ]
	const blurred = subtitlesAll.filter(({ text }) => text.includes("!blur!")); // [ { id, start, end, text } ]
	// remove blurred timestamps from subtitle.
	const subtitles = subtitlesAll.filter(({ text }) => !text.includes("!blur"));
	// Take care of blur cuts // [100, 150] // [start sec, end sec];
	for (const blur of blurred) {
		const startSeconds = Math.floor(timeToSeconds(blur.start));
		const endSeconds = Math.ceil(timeToSeconds(blur.end));
		blurs.push([startSeconds, endSeconds]);
	}

	// new srt.
	const newSrtArr = [];
	// track cut words
	const cutTxtArr = [];
	// keep track of cut time for subtitle alignment.
	let totalSecondsRemoved = 0;
	// debug
	let keepStr = "";
	// invert cuts
	const keeps = []; // [256, 445] in seconds.
	let s = 0;
	for (const [i, sub] of subtitles.entries()) {
		let { id, start, end, text } = sub;
		const startSeconds = Math.floor(timeToSeconds(start));
		const endSeconds = Math.ceil(timeToSeconds(end));
		if (containsSwearWords(state, text)) {
			// invert cuts.
			if (startSeconds === 0) {
				// jump to next endSeconds.
				s = endSeconds;
				const secRemoved = Math.abs(endSeconds - startSeconds);
				totalSecondsRemoved += secRemoved;
				keepStr += `Start time was zero. Seconds removed: ${secRemoved}.\t`;
			} else {
				// check if clips shorter than two seconds.
				if (Math.abs(startSeconds - s) >= 2) {
					const between = `between(t,${s},${startSeconds})`;
					keeps.push([s, startSeconds]);
					const secRemoved = Math.abs(endSeconds - startSeconds);
					totalSecondsRemoved += secRemoved;
					// Log cuts.
					keepStr += `${between}\tSecondsRemoved: ${secRemoved}\t`;
					ws.write(
						`Start:\t${start}\t${startSeconds}\t${startSeconds * frameRate}\nEnd:\t${end}\t${endSeconds}\t${
							endSeconds * frameRate
						}\n\n`,
					);
				} else {
					// ignore clips shorter than two seconds.
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
			const startFix = secondsToTime(
				addSubtractSec("-", timeToSeconds(start), totalSecondsRemoved),
			);
			const endFix = secondsToTime(
				addSubtractSec("-", timeToSeconds(end), totalSecondsRemoved),
			);
			if (text.includes("!ignore!")) text = text.replace("!ignore!", "");
			// push clean srt.
			newSrtArr.push({ id, start: startFix, end: endFix, text });
		}

		// to debug time scale.
		keepStr += `index: ${i}, \tid: ${id}\ts: ${s},\tstart: ${startSeconds}s, ${start}\tend: ${endSeconds}s, ${end}\t\tTotalSecondsRemoved: ${totalSecondsRemoved}s.\n`;
	}

	// if (s < duration) keeps.push(`between(t,${s},${Math.floor(duration)})`);
	if (s < videoMeta.duration) keeps.push([s, Math.floor(videoMeta.duration)]);
	const jsonKeeps = keeps.reduce(
		// biome-ignore lint: convert objet to organized string.
		(acc, cur) => (acc += `${JSON.stringify(cur)}\n`),
		"",
	);
	ws.write(
		`Keep Video Segments ---------------------------------------\n${jsonKeeps}\n\n`,
	);

	// print between times when debug.
	ws.write(
		`getCuts: -keepStr. This logs the time removed from subtitles.\n${keepStr}\n\n`,
	);

	// create new srt file.
	const cleanSubtitleStr = newSrtArr
		.map((b, idx) => ({ ...b, id: idx + 1 })) // fix id
		.reduce((acc, cur) => {
			const { id, start, end, text } = cur;
			// biome-ignore lint/suspicious/noAssignInExpressions lint/style/noParameterAssign: Needed formatting.
			return (acc += `${id}
${start} --> ${end}
${text}

`);
		}, "");

	fs.writeFileSync(cleanSubName, cleanSubtitleStr);
	ws.write(`${cleanSubName}\n${cleanSubtitleStr}\n\n`);

	// Create string of cut words.
	const swearWordsTxt = cutTxtArr.reduce((acc, cur) => {
		const { id, start, end, text } = cur;
		// biome-ignore lint/suspicious/noAssignInExpressions lint/style/noParameterAssign: Needed formatting.
		return (acc += `${start} - ${end} \t${text.trim().replace(/\r?\n/g, " ")}\n`);
	}, "");
	// log
	ws.write(`getCuts: -Swear Words\n${swearWordsTxt}\n\n`);
	return { keeps, blurs };
}

/**
 * Read video metadata and match specs.
 * @param name string. video name. Includes ext.
 * @param args object. args passed in
 * @param ws function. write to log
 * @returns returns video specs object.
 */
async function getMetadata(videoName, args, ws) {
	const { name, ext } = getName(videoName);
	// biome-ignore format: no format
	const options = [
    '-v', 'quiet',
    '-hide_banner',
    '-show_format',
    '-show_streams',
    '-of','json',
    videoName,
  ];
	const specs = await spawnShell("ffprobe", options, ws, false);
	// separate video/audio
	const meta = JSON.parse(specs);
	// Get audio track. If no audio track, get track 0.
	const audioNumber = !Number.isNaN(+args?.["audio-number"])
		? +args["audio-number"] > 0
			? +args["audio-number"] - 1
			: 0
		: 0;
	// metadata may not be in the order you expect. organize.
	const videos = [];
	const audios = [];
	for (const stream of meta?.streams || []) {
		if (stream?.codec_type?.toLowerCase() === "video") videos.push(stream);
		if (stream?.codec_type?.toLowerCase() === "audio") audios.push(stream);
	}
	const video = videos[0];
	const audio = audios[audioNumber];

	// Get Video Frame Rate
	let frameRate = 24;
	const frameRateString = video?.r_frame_rate;
	const frameRates = frameRateString?.split("/");
	if (frameRates.length !== 2) throw new Error("Video Frame Rate not Found.");
	const [numerator, denominator] = frameRates;
	// verify frame rate is a number or throw error before 'eval'.
	if (!Number.isNaN(+numerator) && !Number.isNaN(+denominator))
		frameRate = +(+numerator / +denominator).toFixed(3); // get frames per second.
	else ws.write("Frame Rate Not Found. -----------------------------\n\n");

	// Audio
	// Sample Rate
	let audioSampleRate = +audio?.sample_rate;
	// Bit Rate
	let audioBitRate = args?.["audio-bitrate"]
		? args["audio-bitrate"]
		: +audio?.bit_rate;
	// Codec Name
	let audioCodec = args?.["audio-codec"]
		? args["audio-codec"]
		: audio?.codec_name;
	// If audio not listed. use default.
	if (
		Number.isNaN(audioSampleRate) ||
		Number.isNaN(audioBitRate) ||
		!audioCodec
	) {
		ws.write(
			`Audio Codec Problem. Using defaults. -----------------------\nAudio Sample Rate: ${audioSampleRate}\nAudio Bit Rate: ${audioBitRate}\nAudio Codec: ${audioCodec}\n\n`,
		);
		ws.write(
			`Audio Codec Problem. Audio meta not found.\nAudio Sample Rate: ${audioSampleRate}\nAudio Bit Rate: ${audioBitRate}\nAudio Codec: ${audioCodec}\n\n`,
		);
		audioSampleRate = 48000;
		audioBitRate = args?.["audio-bitrate"] ? args["audio-bitrate"] : "448k";
		audioCodec = "ac3";
		ws.write(
			`Using Audio defaults. -----------------------\nAudio Sample Rate: ${audioSampleRate}\nAudio Bit Rate: ${audioBitRate}\nAudio Codec: ${audioCodec}\n\n`,
		);
	}

	// Video Duration
	// push to end of video
	const duration = await getVideoDuration(name, ext, ws);
	const time = secondsToTime(duration);

	const metadata = {
		frameRateString,
		frameRate,
		audioSampleRate,
		audioBitRate,
		audioCodec,
		duration,
		time,
	};
	return metadata;
}

/**
 * Split video name and extension.
 * @param {string} name video name and extension.
 * @returns object: { name: string, ext: string }
 */
function getName(name) {
	const videoName = name.split(".");
	const ext = videoName.pop().toLowerCase();
	// video name may have more than one decimal in name.
	return { name: videoName.join("."), ext };
}

/**
 * Use ffprobe to extract video seconds.milliseconds from metadata.
 * @param {string} video name including extension.
 * @returns number. Time in seconds.milliseconds
 */
async function getVideoDuration(name, ext, ws) {
	// MKV and AVI containers do not write duration to header. Must use 'format' option.
	const isMKV = ext === "mkv" ? true : ext === "avi";
	// biome-ignore format: no format
	const durationArgs = [
    '-v', 'quiet',
    '-hide_banner',
    '-print_format', 'flat',
    '-show_entries',  isMKV ? 'format=duration' : 'stream=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    '-select_streams', 'v:0',
    `${name}.${ext}`
  ]
	let duration = await spawnShell("ffprobe", durationArgs, ws, false);
	duration = +duration.trim();
	// check if duration is NaN
	if (Number.isNaN(duration)) {
		ws.write(`Duration was NaN: ${duration}\n\n`);
		throw new Error(`Duration was NaN: ${duration}`);
	}
	ws.write(
		`Video Length: Seconds.Milliseconds: ${duration}, Time: ${secondsToTime(duration)}\n\n`,
	);

	return duration;
}

/**
 * Filter list of files for video type, and remove temporary videos from list.
 * @returns string[]: List of video names.
 */
function getVideoNames() {
	// filter for common video types.
	const vidext = ["\\.mp4$", "\\.mkv$", "\\.avi$", "\\.webm$"];
	const extRegex = new RegExp(vidext.join("|"));
	// filter out videos made from the program.
	const avoidVideos = ["output", "clean", "temp", "sanitize", "withSubtitle"];
	// create video list, filtering videos.
	const avoidRegex = new RegExp(
		avoidVideos.map((a) => vidext.map((v) => `${a}${v}`).join("|")).join("|"),
	);
	const videos = fs
		.readdirSync(process.cwd())
		.filter((file) => extRegex.test(file))
		.filter((file) => !avoidRegex.test(file));
	console.log(videos);
	return videos;
}

/**
 * Convert seconds,milli back to Time.
 * @param {number} time Time in seconds and milliseconds
 * @returns string. '00:00:00,000'
 */
function secondsToTime(time) {
	// return timeStamp format.
	const [sec, milli = "000"] = time.toString().split(".");
	const hours = Math.floor(sec / 3600);
	const hourStr = hours.toString().padStart(2, "0");
	const minutes = Math.floor((sec % 3600) / 60);
	const minuteStr = minutes.toString().padStart(2, "0");
	const seconds = sec - (hours * 3600 + minutes * 60);
	const secStr = seconds.toString().padStart(2, "0");
	const milliStr = milli.toString().padEnd(3, "0");
	// console.log('time', time, 'hours', hours, 'minutes', minutes, 'seconds', seconds, 'milli', milli);
	return `${hourStr}:${minuteStr}:${secStr},${milliStr}`;
}

/**
 * Run OS programs from Nodejs environment.
 * @param {string} command bash command of program
 * @param {array} spawnArgs array of arguments. -No spaces. Must be comma separated.
 * @returns string, stdout
 */
async function spawnShell(command, spawnArgs, ws, view = true) {
	const { spawn } = require("node:child_process");
	return new Promise((resolve, reject) => {
		let stdout = "";
		try {
			const msg = `Running command: ${command} ${spawnArgs.join(" ")}\n\n`;
			ws.write(msg);
			console.log(msg);
			const process = spawn(command, spawnArgs);
			process.stdout.on("data", (data) => {
				if (view) console.log(data.toString());
				stdout += data;
			});
			process.stderr.on("data", (data) => {
				if (view) console.log(data.toString());
				stdout += data;
			});
			process.on("close", (code) => {
				if (code === 0) {
					resolve(stdout);
				} else {
					const error = new Error(
						`Command "${command} ${spawnArgs.join(" ")}" exited with code ${code}`,
					);
					error.code = code;
					error.stdout = stdout;
					ws.write(
						`Error: Command "${command} ${spawnArgs.join(" ")}" exited with code ${code}.\n${stdout}\n\n`,
					);
					reject(error);
				}
			});
			process.on("error", (error) => {
				ws.write(error.toString());
				reject(error);
			});
		} catch (error) {
			// biome-ignore format: no format
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
	// subtitle errors can be vague.
	try {
		const srt = fs.readFileSync(subTitleName, "utf-8");
		ws.write(`originalSubtitles:\n${srt}\n\n`);
		// read srt, split into blocks. -convert to object.
		const subtitles = srt
			.split(/\r?\n\r?\n\d{1,5}\r?\n?$/m)
			.map((block, idx) => {
				let rawTime = "";
				let text = "";
				// first line will keep id
				if (idx > 0) {
					[rawTime, ...text] = block.trim().split(/\r?\n/);
				} else {
					[_, rawTime, ...text] = block.trim().split(/\r?\n/);
				}
				// console.log('rawTime', rawTime, 'text', text);
				const [start, end] = rawTime.split(" --> ");
				return {
					id: idx + 1,
					start,
					end,
					text: text.join("\n").trim(),
				};
			});

		// const subStr = subtitles.reduce((acc, cur) => {
		// 	const { id, start, end, text } = cur;
		// 	// biome-ignore lint/suspicious/noAssignInExpressions lint/style/noParameterAssign: Needed formatting.
		// 	return (acc += `${id}\n${start} --> ${end}\n${text}\n\n`);
		// }, "");

		ws.write(`splitSubtitles:\n${JSON.stringify(subtitles)}\n\n`);
		return subtitles;
	} catch (error) {
		const msg = `
\x1b[31m${subTitleName} Read Error:
\x1b[33mThere was a problem parsing the subtitle ${subTitleName}.
Check the first line in ${subTitleName} is a number.
The problem could also be file header corruption:
  Copy ${subTitleName} contents into a new file and save. 
  Delete old srt file.
  Rename new file as: ${subTitleName}\x1b[0m
\n\n
`;
		ws.write(`${msg}`);
		throw new Error(msg);
	}
}

/**
 * Convert time as string into seconds.milliseconds
 * @param {string} time '00:00:00,000' hour : minute : second, millisecond
 * @returns number. decimal to 3 places.
 */
function timeToSeconds(time) {
	if (!time) return "";
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
async function transcribeVideo(state, ws) {
	const { video } = state;
	const msg = `Could not extract subtitles from ${video}.\nStarting Docker with AI transcription.\nThis will take a few minutes to transcribe video.\n\n`;
	ws.write(msg);
	console.log("\x1b[35m", msg);
	console.log("\x1b[0m", "");
	// biome-ignore format: no format
	const dockerArgs = [
      'run', '--rm',
      '-v', `${process.cwd()}:/data`,
      '-v', `${process.cwd()}/.whisper:/app/.whisper`, 'jveldboom/video-swear-jar:v1',
      'clean',
      '--input', video,
      '--model', 'tiny.en',
      '--language', 'en',
    ]
	const stdout = await spawnShell("docker", dockerArgs, ws);
	ws.write(`transcribeVideo:\nstdout: ${stdout}\n\n`);
	return;
}
/**
 * Docker must be running. Pulls the Video-Swear-Jar image. AI transcribes the audio to text and outputs a clean version of video.
 * // https://github.com/jveldboom/video-swear-jar
 * @param {string} video Video name and extension.
 * @returns object: { stdout: string stderr: string }
 */
async function zipVideo(state, ws) {
	const { video, subName, name } = state;
	const stdout = await spawnShell(
		"7z",
		["a", "-t7z", `${name}.7z`, video, subName],
		ws,
	);
	ws.write(`zip:\nstdout: ${stdout}\n\n`);
	return;
}

module.exports = {
	addSwearWords,
	containsSwearWords,
	convertMsToTime,
	deleteFiles,
	extractSubtitle,
	filterGraphAndEncode,
	getArgs,
	getCuts,
	getName,
	getMetadata,
	getVideoDuration,
	getVideoNames,
	recordMetadata,
	spawnShell,
	transcribeVideo,
	zipVideo,
};
