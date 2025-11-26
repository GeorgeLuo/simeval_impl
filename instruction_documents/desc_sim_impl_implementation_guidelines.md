## Implementation Guidelines

### Code Structure

The structure of the workspace for implementations is greatly simplified from simeval as the intent is to house plugin definitions. Test files and directories may be created at discretion.

\<simulation-name\>/  
├── world\_desc/  
│   └── \<descriptions of world\>  
│  
├── verification/  
│   ├── verifier.sh  
│   └── \<helper-files\>  
│  
├── memory/  
│   └── phenomena/  
│       └── phenomena.md  
│  
└── src/  
    └── plugins/  
        ├── simulation/  
        │   ├── components/  
        │   │   └── (simulation components)  
        │   └── systems/  
        │       └── (simulation systems)  
        │  
        └── evaluation/  
            ├── components/  
            │   └── (evaluation components)  
            └── systems/  
                └── (evaluation systems)

#### Memory

The memory directory of the workspace should be used to store artifacts outside of plugin code. This should be treated as a filesystem to store intermediate files to the generation and verification of the simulation world.

### Schedule of Work

Phase 1 — World Definition

* Phenomener names the workspace and transcribes the world description.  
* Phenomener enumerates the minimal set of temporal phenomena for the world.

Phase 2 — Verification Design

* Expecter creates script(s) to validate the defined phenomena against simeval output streams.

Phase 3 — Plugin Implementation

* Implementer writes plugin implementations (simulation and evaluation components/systems) to realize the world.

Phase 4 — Deployment & Capture

* Implementer uploads plugins to the sim-eval server.  
* Implementer runs the simulation and captures the output

Phase 5 — Verification & Iteration

* Implementer and/or Expecter runs the verifier against captured output.  
* Repeat implementation, upload, run, capture, and verification until all phenomena validate and errors are rectified.

Phase 6 — Change Management

* On changes to the world description, repeat Phases 1–5 to realign phenomena, verification scripts, and plugin implementations.

## 

