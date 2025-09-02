# Rated-G

- Simple script that removes undesirable video, audio and subtitle text while keeping movie audio and subtitles in sync.
- Inspired by [Video Swear Jar](https://github.com/jveldboom/video-swear-jar).
- Using subtitles can be faster and more accurate than AI transcribing.

## Dependencies

- [Nodejs](https://nodejs.org/en/download/package-manager) installed.
- [ffmpeg](https://www.ffmpeg.org/download.html) installed.
  - [ffmpeg windows build](https://www.gyan.dev/ffmpeg/builds/)
  - [ffmpeg Nvidia Linux build](https://docs.nvidia.com/video-technologies/video-codec-sdk/11.1/ffmpeg-with-nvidia-gpu/index.html#compiling-for-linux)
- To 'clean' video, subtitles are a great option. If you want to use the _Video Swear Jar_ Docker Image to transcribe the audio, [Docker](https://docs.docker.com/engine/install/) must be installed.
- For FFmpeg to user your GPU, you must download **your GPU Video codec package** and compile FFmpeg with GPU options enabled.
  - e.g. **NVIDIA GeForce 1050Ti** codec package: [CUDA Toolkit 12.6](https://developer.nvidia.com/cuda-downloads)
  - Get the toolkit for **your GPU**, or use the `--cpu` flag to only use the CPU.
- [7zip](https://7-zip.org/download.html) installed if you want to use the `--zip` flag.
  - To verify if 7zip is added to path: open cmd/shell: `7z` // some linux versions can be `7za`.

## FFmpeg Encoding

- Once the video is cut, the timeline is broken. This can cause the audio and video to be out of sync during playback. Encoding fixes this.
- GPU encoding is faster than CPU encoding. The [clean.js](https://raw.githubusercontent.com/webmastersmith/Rated-G/refs/heads/main/clean.js) script default encoding with a Nvidia GPU. If you get errors, find the codec that works for your pc hardware and fix the arguments in the **filterGraphAndEncode** function.

## Simple Start

1. Copy the [clean.js](https://raw.githubusercontent.com/webmastersmith/Rated-G/refs/heads/main/clean.js) file into the directory with **video** and **subtitle**. (If you do not have subtitle file, _Video Swear Jar_ Docker image will be called to transcribe audio. [Docker](https://docs.docker.com/engine/install/) must be installed).
   1. **Note**: subtitles must have the same name as the video, with an `.srt` extension. (e.g. `video1.mp4`, `video1.srt`).
2. run from command line in same directory: `node clean.js --cpu`

## Flags

```sh
node clean.js --clean # deletes all files and videos (including original), except clean video and log file.
node clean.js --clean-all # deletes all files and videos (including original) except clean video.
node clean.js --debug # Do not delete files or videos.
node clean.js --report # ffmpeg debugging. ffmpeg creates it's own log file.
node clean.js --skip # just re-encode video, do not alter content.
node clean.js --zip # 7zip must be added to your path. 7Zip archives the original video and subtitle and removes original video and subtitle by enabling the '--clean' flag.

# Video Hardware
# Quality=1-51 (best image <--> smaller file size)
node clean.js --quality=27 # CPU & GPU. 27 default. 18-30 is best.
  # Depending on original video compression, 27 produces video similar in size or smaller than original.
# CPU
node clean.js --cpu # default GPU. Use your CPU instead of GPU to encode video.
node clean.js --cpu --h265 # CPU only. Default CPU encoding uses the h264 codec.
# GPU
node clean.js --smallest # GPU only. Smaller file size while keeping image quality, but increases encoding time.
node clean.js --h264 # GPU only. H265 default. Use older codec for older devices.
node clean.js --10-bit # GPU only. Best for videos already encoded at 10 bit.

# Audio
node clean.js --audio-bitrate=128k # 128k default. Set custom bit rate for audio.
node clean.js --audio-number=0 # 0 default. First audio track.
node clean.js --audio-codec=aac # default: Rated-G will use audio metadata to match original codec unless you override. Options: aac, ac3, flac, opus or any valid ffmpeg audio codec.
# Note: Rated-G will try to use the original audio codec. Experimental mode is on.
node clean.js --audio-experimental # turn on --strict-experimental flag. This allows codecs that are not main stream.
## Some codecs are experimental because they are not supported by some vendors, so codec may not play on your device.

# Metadata and Subtitles
node clean.js --copy # Create clone of video and embed subtitles.
node clean.js --no-chapters # remove chapters. default is keep chapters.
node clean.js --subtitle-number=0 # 0 default. First subtitle.
# view subtitles with ffprobe. Built into ffmpeg. First subtitle is index 0.
  # ffprobe -loglevel error -select_streams s -show_entries stream=index:stream_tags=language -of csv=p=0 video.mkv

# Swear Words
node clean.js --ignore="word1 word2 word3" # removes swear words from list.
node clean.js --add="word1 word2 word3" # add swear words to remove list.

# Example
node clean.js --cpu --h265 --quality=28 --audio-number=1 --subtitle-number=1
```

## Subtitles

- Most video subtitles can be found online. Make sure the subtitle matches the video. Cuts to video will be wrong if subtitle is wrong.
- Sometimes subtitles do not provide perfect alignment, but their really close. Editing the subtitle file time can make sure to remove undesirable video and audio.
- **Extra Cuts**
  - If you would like to take out other parts (e.g. nudity, drugs, violence...), add the time to the subtitles file.
  - `6` <-- Can be any number, but must be a number.
  - `00:00:34,000 --> 00:01:56,000` // the spacing and format must be exact. `start --> end` timestamp.
    - `00:00:00,000` <-- hours:minutes:seconds,milliseconds
    - **Caution!** Do not let times overlap with other subtitles. Remove the subtitles within the cut section.
  - `!remove!` <-- special key word. Remove timestamp
  - `!ignore!` <-- special key word. Ignore content, even if swearword.

```sh
# Example of customer video removal timestamps.
6 # must be a number. Can use any number.
00:00:34,000 --> 00:01:56,000 # start time --> end time [hour:minute:second,millisecond]
!remove! # special keyword.

# Example of ignoring a swearword match.
9
00:02:36,000 --> 00:02:39,000
Subtitle text you want to keep. !ignore!
```

## Blurring Video Segments

- Blur the whole screen during 'blur timestamp'. This allows you to you to keep audio, while blurring video.
- Blur timestamps are removed from the subtitle file during build.
- Blur timestamps can overlap with other subtitle timestamps without affecting them.
- The audio will not be affected.
- Blurred timestamp example ↓.

```sh
# Blurring video example.
135 # must be a number. Can use any number.
00:02:36,000 --> 00:02:39,000 # start time --> end time [hour:minute:second,millisecond]
!blur! # special keyword.
```

## Troubleshooting

- **Partial Video Output**: downloaded video can have corrupted frames, yet still play. Re-encode video then re-run _clean.js_.
  - (e.g. `ffmpeg -y -i <video> -c:v libx264 -c:a aac -b:a 384k -ar 48000 <out-video>`)
- **Subtitle Error**: downloaded subtitles can have a corrupted 'head' section, that FFmpeg will not be able to open. Copy file contents into new file.
  - Check the subtitle name is the same as video name. (e.g. `video.mp4`, `video.srt`).
  - The **subtitle file header is possible corrupted**. Copy contents to new file and save. Delete old file.
- **Docker Error**: If no subtitles are found, [Video Swear Jar](https://github.com/jveldboom/video-swear-jar) image will be called to transcribe video. Docker engine must be installed and running.
