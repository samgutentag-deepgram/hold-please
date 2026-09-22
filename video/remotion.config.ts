import { Config } from '@remotion/cli/config'

// A booth screen plays this all day on a loop, so the file has to be small enough to sit on a
// laptop and clean enough to survive a projector. CRF 18 on h264 is the compromise: large flat
// areas of #0b0d10 compress well, and the thin 3px threshold marker does not band.
Config.setVideoImageFormat('jpeg')
Config.setCodec('h264')
Config.setCrf(18)
Config.setChromiumOpenGlRenderer('angle')
Config.setOverwriteOutput(true)
