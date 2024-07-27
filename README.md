# Rated-G

- Simple script that extracts swear words from the subtitles and cuts those lines out of the video. Inspired by [Video Swear Jar](https://github.com/jveldboom/video-swear-jar).
- Subtitles are more accurate than AI transcribing.

## Dependancies

- [Nodejs](https://nodejs.org/en/download/package-manager) installed.
- [ffmpeg](https://www.ffmpeg.org/download.html) installed.
- It is better to find subtitles, they are more accurate. If you want to use the Video Swear Jar Docker Image, [Docker](https://docs.docker.com/engine/install/) must be installed.

## Simple Start

- clone repo: `git clone git@github.com:webmastersmith/Rated-G.git`
- copy videos and subtitles into same directory you just downloaded.
  - subtitles must have the same name as the video, with an `.srt` extension.
  - (e.g. `video1.mp4`, `video1.srt`)
- run from command line in same directory: `node clean.js`

## Subtitles

- most video subtitles can be found online. Make sure the subtitle matches the video. Cuts to video will be wrong if subtitle is wrong.
- **Error** about reading subtitles:
  - Check the file name is not same as videos.
  - The file header is possible corrupted. Copy contents to new file and save. Delete old file.
- **Extra Cuts**
  - if you would like to take out other parts (e.g. nudity, drugs, violence...), add the time to the subtitles file.

```txt
6   <-- any number. must be a number -->
00:00:34,000 --> 00:01:56,000   <-- hours:minutes:seconds,milliseconds -->
!remove! <-- special key word -->
```

## FFmpeg Encoding

- Encoding is the process of parsing the input and putting it in a format(codec) with fixed timeline.
- Once the video is cut, the timeline is broken. This can cause the audio and video to be out of sync. Encoding fixes this.
- GPU encoding is more than ten times faster than CPU encoding. The script is already setup for encoding with Nvidia GPU. If you get errors, find the codec that works for your pc hardware and fix the arguments in the **encodeVideo** function.

```js
// GPU example
const args = [
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

// CPU example
const args = [
  '-y',
  '-i', joinedVideoName,
  '-i', subTitleName,
  '-c:v', 'libx264',
  '-crf', 26,
  '-c:a', 'aac', '48k',
  cleanVideoName
]
```