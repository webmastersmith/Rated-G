# Rated-G

- Simple script that removes undesirable video and audio. Swear words are removed from the subtitles. Inspired by [Video Swear Jar](https://github.com/jveldboom/video-swear-jar).
- Subtitles are more accurate than AI transcribing.

## Dependencies

- [Nodejs](https://nodejs.org/en/download/package-manager) installed.
- [ffmpeg](https://www.ffmpeg.org/download.html) installed.
- It is better to find subtitles, they are more accurate. If you want to use the Video Swear Jar Docker Image, [Docker](https://docs.docker.com/engine/install/) must be installed.

## Simple Start

- clone repo: `git clone git@github.com:webmastersmith/Rated-G.git`
- copy videos and subtitles into the Rated-G directory.
  - subtitles must have the same name as the video, with an `.srt` extension.
  - (e.g. `video1.mp4`, `video1.srt`)
- run from command line in same directory: `node clean.js`

## Flags

```sh
node clean.js --clean # deletes all files and videos (including original), except clean video.
node clean.js --debug # verbose output. Does not delete files or videos.
node clean.js --cpu # if you want to use your CPU instead of GPU.
node clean.js --report # ffmpeg debugging. ffmpeg creates it's own log file.

# Quality
# 1(best, massive file size) <--> 51(worst, smallest file size) 24-30 is best.
node clean.js --quality=27 # 27 default for 10-bit. 25 default for 8-bit.

# 10 -bit -GPU only
node clean.js --10-bit # encodes 10 bit. Doubles time it takes to encode.
```

## Subtitles

- Most video subtitles can be found online. Make sure the subtitle matches the video. Cuts to video will be wrong if subtitle is wrong.
- Subtitles do not provide perfect alignment, but their really close. Editing the time can make sure to remove undesirable video and audio.
- **Error** about reading subtitles:
  - Check the subtitle name is the same as video name. (e.g. `video.mp4`, `video.srt`).
  - The **subtitle file header is possible corrupted**. Copy contents to new file and save. Delete old file.
- **Extra Cuts**
  - If you would like to take out other parts (e.g. nudity, drugs, violence...), add the time to the subtitles file.
  - `6` <-- Can be any number, but must be a number.
  - `00:00:34,000 --> 00:01:56,000` <-- `start --> end` the spacing and format must be exact.
    - `00:00:00,000` <-- hours:minutes:seconds,milliseconds
    - **Caution!** Do not let times overlap with other subtitles. Remove the subtitles within the cut section.
  - `!remove!` <-- special key word.

```txt
6
00:00:34,000 --> 00:01:56,000
!remove!
```

## FFmpeg Encoding

- Once the video is cut, the timeline is broken. This can cause the audio and video to be out of sync during playback. Encoding fixes this.
- GPU encoding is more than ten times faster than CPU encoding. The script is already setup for encoding with Nvidia GPU. If you get errors, find the codec that works for your pc hardware and fix the arguments in the **filterGraphAndEncode** function.

```js
// GPU example
// prettier-ignore
const args = [
  '-y',
  // '-report',
  '-hide_banner',
  '-v', 'error', '-stats',
  '-hwaccel', 'cuda',
  '-i', video,
  '-i', subtitleName,
  '-vf', `select='${cuts.join('+')}', setpts=N/FRAME_RATE/TB`,
  '-af', `aselect='${cuts.join('+')}', asetpts=N/SAMPLE_RATE/TB`,
  '-c:v', 'hevc_nvenc',
  '-preset', 'fast',
  '-c:a', 'aac',
  '-b:a', '112k',
  '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng',
  cleanVideoName
  ]

// CPU example
// prettier-ignore
const args = [
  '-y',
  // '-report',
  '-hide_banner',
  '-v', 'error', '-stats',
  '-i', video,
  '-i', subtitleName,
  '-vf', `select='${cuts.join('+')}', setpts=N/FRAME_RATE/TB`,
  '-af', `aselect='${cuts.join('+')}', asetpts=N/SAMPLE_RATE/TB`,
  '-c:v', 'libx264',
  '-crf', 26,
  '-c:a', 'aac',
  '-b:a', '128k',
  '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng',
  cleanVideoName
  ]
```
