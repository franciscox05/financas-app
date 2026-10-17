import { Composition } from 'remotion'
import { Pitch, pitchSchemaDefaults } from './Pitch'
import { DURATION, FPS } from './timeline'

export const Root = () => (
  <>
    <Composition
      id="Pitch"
      component={Pitch}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={pitchSchemaDefaults}
    />
    {/* Mesma montagem em vertical, para reels/stories. */}
    <Composition
      id="PitchVertical"
      component={Pitch}
      durationInFrames={DURATION}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ ...pitchSchemaDefaults, vertical: true }}
    />
  </>
)
