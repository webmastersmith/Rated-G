# Rated-G

- Simple script that removes undesirable video and audio. Swear words are removed from the subtitles. Inspired by [Video Swear Jar](https://github.com/jveldboom/video-swear-jar).
- Subtitles are faster and can be more accurate than AI transcribing.

## Dependencies

- [Nodejs](https://nodejs.org/en/download/package-manager) installed.
- [ffmpeg](https://www.ffmpeg.org/download.html) installed.
  - [ffmpeg windows build](https://www.gyan.dev/ffmpeg/builds/)
  - [ffmpeg Nvidia Linux build](https://docs.nvidia.com/video-technologies/video-codec-sdk/11.1/ffmpeg-with-nvidia-gpu/index.html#compiling-for-linux)
- It is better to find subtitles, they are more accurate. If you want to use the Video Swear Jar Docker Image, [Docker](https://docs.docker.com/engine/install/) must be installed.
- If you want FFmpeg to user your GPU, you must download **your GPU Video codec package**.
  - e.g. **NVIDIA GeForce 1050Ti** codec package: [CUDA Toolkit 12.6](https://developer.nvidia.com/cuda-downloads)
  - Get the toolkit for **your GPU**, or use the `-cpu` flag to only use the CPU.

## Simple Start

1. Copy [clean.js](https://raw.githubusercontent.com/webmastersmith/Rated-G/refs/heads/main/clean.js) in directory with **video** and **subtitle**. (no subtitle, _Docker_ must be installed for '_Video Swear Jar_' to run).
   1. subtitles must have the same name as the video, with an `.srt` extension.
   2. (e.g. `video1.mp4`, `video1.srt`)
2. run from command line in same directory: `node clean.js --cpu`

## Flags

```sh
node clean.js --clean # deletes all files and videos (including original), except clean video and log file.
node clean.js --clean-all # deletes all files and videos (including original) except clean video.
node clean.js --debug # Do not delete files or videos.
node clean.js --report # ffmpeg debugging. ffmpeg creates it's own log file.
node clean.js --skip # just re-encode video, do not alter content.

# Video Hardware
node clean.js --cpu # if you want to use your CPU instead of GPU.
# Quality=1-51 (best image <--> smaller file size)
node clean.js --quality=26 # 26 default. 18-30 is best. 26 produces video similar in size as original.
node clean.js --smallest # slightly smaller file size with same image quality but increases encoding time.
node clean.js --h264 # use older codec for older devices.
node clean.js --video-filter # different type of ffmpeg editing method. If more than 20 cuts, can have audio/video sync issues.
# 10-bit -GPU only
node clean.js --10-bit # encodes 10 bit. Best for videos already encoded at 10 bit.

# Audio
node clean.js --bit-rate=128k # 128k default. Set custom bit rate for audio.
node clean.js --audio-number=0 # 0 default. First audio track.

# Metadata and Subtitles
node clean.js --no-chapters # remove chapters. default is keep chapters.
node clean.js --subtitle-number=0 # 0 default. First subtitle.
# view subtitles with ffprobe. Built into ffmpeg. First subtitle is index 0.
  # ffprobe -loglevel error -select_streams s -show_entries stream=index:stream_tags=language -of csv=p=0 video.mkv


# Example
node clean.js --10-bit --quality=24 --audio-number=1
```

## Subtitles

- Most video subtitles can be found online. Make sure the subtitle matches the video. Cuts to video will be wrong if subtitle is wrong.
- Sometimes subtitles do not provide perfect alignment, but their really close. Editing the subtitle file time can make sure to remove undesirable video and audio.
- **Error** about reading subtitles:
  - Check the subtitle name is the same as video name. (e.g. `video.mp4`, `video.srt`).
  - The **subtitle file header is possible corrupted**. Copy contents to new file and save. Delete old file.
- **Docker Error**: If no subtitles are found, [Video Swear Jar](https://github.com/jveldboom/video-swear-jar) image will be called to transcribe video. Docker engine must be installed and running.
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
- GPU encoding is faster than CPU encoding. The script is already setup for encoding with a Nvidia GPU. If you get errors, find the codec that works for your pc hardware and fix the arguments in the **filterGraphAndEncode** function.

## Troubleshooting

- **Partial Video Output**: downloaded video can have corrupted frames, yet still play. Re-encode video then re-run _clean.js_.
  - (e.g. `ffmpeg -y -hwaccel cuda -i <video> -c:v h264_nvenc -c:a aac -b:a 384k -ar 48000 <out-video>`)
- **Subtitle Error**: downloaded subtitles can have a corrupted 'head' section, that FFmpeg will not be able to open. Copy file contents into new file.
