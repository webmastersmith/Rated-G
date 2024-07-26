# Rated-G

- Simple script that extracts swear words from the subtitles and cuts those lines out of the video. Inspired by [Video Swear Jar](https://github.com/jveldboom/video-swear-jar).

## Dependancies

- [Nodejs](https://nodejs.org/en/download/package-manager) installed.
- [ffmpeg](https://www.ffmpeg.org/download.html) installed.
- It is better to find subtitles, they are more accurate. If you want to use the Video Swear Jar Docker Image, [Docker](https://docs.docker.com/engine/install/) must be installed.

## Simple Start

- clone repo: `git clone git@github.com:webmastersmith/Rated-G.git`
- copy videos and subtitles into same diretory you just downloaded.
  - subtitles must have the same name as the video, with an `.srt` extension.
- run from command line in same directory: `node clean.js`

## FFmpeg Encoding

- I use GPU encoding with Nvidia. If you get errors, fix arguments in the encode function.