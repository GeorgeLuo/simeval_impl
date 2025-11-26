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

