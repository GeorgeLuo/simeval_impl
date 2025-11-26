# Ch. 2\. Implementing Simulation

At this point, you should have a semi-portable simeval engine with an api for initializing and running ECS patterned programs. Earlier we’ve stated the benefit of ECS in orderly environment definition through the inherent modularity of systems. How do we maximize this benefit, and what are anti-patterns that negate this benefit?

## System Design

An individual system should be limited to the smallest scope of causality possible. This is not a precise directive, as like deciding when to use interfacing in OOP. Systems can technically be discretized until they are loops of a single operation with business logic concentrated in component filtering. 

Towards a common vocabulary, we’ll summarize the general structure of a system (to be clear, we’re describing parts of a for-each loop):

* Filter: the mechanism that sits at the top of a system to generate the iteration source, being all entities with certain components as the scope  
* Transformation: the business logic that actions on each entity selected by the filter, propagating change in through entities and components

The transformation to action upon all these entities should compute with all these specific components and most of the business logic should be relevant to most of the entities. It is an anti-pattern to lean substantially on case logic in systems, hinting at suboptimal component definition. We should have some sense that transformations should create or modify entities and components outside of that initial filtering in order for change to propagate. It is an anti-pattern to transform the same component states multiple times in a single pass, leading to hidden states.

## Component Design

The vocabulary we’ll use to describe components:

* Type: the component type matched by the class name of a component, like a literal name of a field  
* Value: the internal payload of data captured by a specific component instance, with a defined schema

Typing internal to the payload of components is an anti-pattern, being impossible to index by the ECS engine. The schema of component values being multi-parameter is an anti-pattern for the same reason. For the same amount of information captured for an entity, it is better to have more components with less data per component than to have fewer components with more data.

## Testing

Fundamentally the ECS engine was defined with object-oriented building blocks, which lends to test-driven development, given the discretized nature of inputs and verifiable outputs. TDD works well with highly vertical code as with flat architectures. With ECS implementations of world behavior, TDD is less meaningful. You can verify the behavior of individual systems with high coverage, but the canonical systems transform the environment in ways that are very noisy.

Systems may be non-commutative. This simply means a seeded environment transformed by system A and then by system B may not lead to the same state after transformation through system B and then system A. We can see this with textual builder patterns: function A appends text and function B capitalizes text. A followed by B results in a fully capitalized string, but B followed by A results in mixed casing.

### On Absolute Validation

Let’s try to approximate what perfect verification of an ECS implementation looks like. You have a seeded environment state and you have every intermediate component state from system to system until you have the state of the environment as it enters the next state. You verify that each component value is correctly transformed through the frame. This is still approximate; there very well could be multiple touches to components within a single system (anti-pattern as it is). That aside, while technically feasible, this is not practical. We’ve only verified a frame of a nearly infinite number of permutations of component values. This would certainly be unrealistic to employ in an iterative development pattern.

Testing of ECS implementations should orient around validation of causality within the environment rather than validation of behavior of code. This is analogous to code coverage; test code may be shorter or longer to achieve the same amount of coverage and there is intuition that shorter achieves coverage with less redundancy (lines of code visited). Repetitive visitation is not inherently bad, but signals testing for the sake of making sure code acts like code, that computers act like computers. Sufficiency of verification of code is measured by coverage, but coverage itself is graded against redundancy and for behavior. 

Revisiting the fact that ECS was developed for modern game development we can expect some parallels in testing with frontend. Visual mediums consider smoothing of edges to be desirable, contrary to autonomous codebases which treat smoothing as obfuscation. A game that renders out-of-bounds spaces and self-recovers in a few frames or a login page that logs the user out on an operation due to an expired token is smoothing behavior, tolerable. A helper function that catches exceptions and simply returns default values is intolerable.

ECS for simulation, unlike a game engine, demands the high threshold of causal veracity as with an autonomous codebase, but cannot lean solely on unit testing and is incomplete still with additional perceptual testing strategies.

### Causal Validation

The next approach assumes simulation as leading to observations of emergent phenomena through understood phenomena. Extending this framing, emergent phenomena cannot be verified, only what is understood can be. This is useful towards accepting that the sum validity of causal transformation of each phenomenon over some time frame is as meaningful as the theoretical perfect verification over that same time frame. For our purposes, the parts of the sum are centered around components. 

We can realistically formalize expectations around a component type through a time-series, given a seeded environment that includes a stimulus producing an understood change. For example, we should expect a ball’s position component to predictably be affected by forces acting upon the ball. If we had an environment defined with a system for gravitational force and seeded this environment with a ball, the frames captured by the playback of this simulation should show the ball’s descent. 

In summary, validating an understood phenomenon in ECS can be achieved through:

1. Seed environment with initial conditions expected to give rise to the phenomenon  
2. Run the simulation to capture environment behavior through simeval output streams  
3. Verify stream data for the phenomenon

A system in isolation expresses only understood phenomena (this must be true as codification of a system is an effort of codification of phenomena). As systems are introduced to the environment, the number of phenomena within the environment grows to exceed the sum of the understood phenomena per system. With few systems, we have semi-understood phenomena, things that we can intuit, but at a certain point we begin to see emergent phenomena. The validation process enumerated above lends to a gradual process towards verifying ECS environments up to the point of semi-understood phenomena in order to build confidence in observance of emergent phenomena. In a sense, we are finding a way to “trust our eyes.”

### Boundaries of Veracity

Bluntly, validation is not fun, but unit and perception based testing is rote (in a positive sense). Unit testing is bounded by coverage and perception based testing on permutations of interaction. The causal validation approach described above is not bounded in a computational sense. It requires some heuristic understanding of the intent of a world model. The unbounded nature flows down to the implementation of tests, there is no coverage measurement nor interaction matrix.

We might attempt to define a framework or find universality through a rules based approach. If we’re validating output streams, a BRMS (business rules management system) can serve to define checks such as one-and-only-one entity definition and component lifecycles. This approach has computational scalability with modularity of condition definitions. While a rules engine is attractive for these reasons, BRMS mismatches where conditional statements in simulation are too dimensionally rich. We are back to wrangling the absolute validation problem.

Despite the impracticality of BRMS for simulation, we can observe rule definition is very tractable. Similar to behavioral testing’s “when I click this, then I should observe this,” we can define “when this happens, then I should observe this.” To align with simulation space:

“With an environment state A, through the passage of time T, we should observe event(s) E.”

BRMS as a compilation engine for the evaluator of the statement is impractical, but it is trivial to define these types of statements; from what can be described comes what is understood. Further, their definition sums to the edge of semi-understood phenomena (which is as far as we need to achieve).

Towards grounding our thoughts we’ll formalize expectations of a validation design pattern that scales:

* Semi-structured natural language statements are constructed to define understood phenomena  
* Statements are codified as verifiers which consume frames from a simulation run  
* Updates to the world model which should reflect the same understood phenomena re-use the same verifiers

And we’ll proceed to define agentic instructions to generally implement simulations before returning to the ball physics problem for a concrete test against the assumptions of this section.

