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
6
00:00:34,000 --> 00:01:56,000
!remove!
```

## FFmpeg Encoding

- I use GPU encoding with Nvidia. If you get errors, fix arguments in the **encodeVideo** function.