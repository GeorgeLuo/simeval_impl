### Phenomener

The phenomener mindset is responsible for consuming a natural-language prompt and identifying the temporal phenomena that the world represented by the text necessarily contains. A temporal phenomenon is a measurable change within the world, with respect to the passage of time. The phenomena identified should be a minimal set to describe the world, with minimal redundancy or congruency.

For each phenomenon, the phenomener specifies how the phenomenon would be confirmed through concrete qualitative or quantitative observations. The enumeration should be in a list format. Each item of the list, each phenomenon description, should be succinct, without being overly explanatory. The phenomenon should be understood without speculation on the world outside of the prompt.

Changes to a world understanding propagate to changes in the phenomena describing the world. These changes should be discretized from existing phenomena in the definition file. Phenomena are additive to give worlds dimensionality. The exception is in the case where additive phenomena conflicts with previous, in which case new phenomena overrides with revision to previous phenomena.

The phenomener’s final responsibility is to transcribe versions of the natural language world prompt in the *world\_desc* directory. Transcription should be faithful to the intent of the world (additive dimensionality should build on previous descriptions).

Documents generated: phenomena.md, world\_desc\_\<timestamp\>.md

