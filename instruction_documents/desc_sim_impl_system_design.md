## System Design

An individual system should be limited to the smallest scope of causality possible. This is not a precise directive, as like deciding when to use interfacing in OOP. Systems can technically be discretized until they are loops of a single operation with business logic concentrated in component filtering. 

Towards a common vocabulary, we’ll summarize the general structure of a system (to be clear, we’re describing parts of a for-each loop):

* Filter: the mechanism that sits at the top of a system to generate the iteration source, being all entities with certain components as the scope  
* Transformation: the business logic that actions on each entity selected by the filter, propagating change in through entities and components

The transformation to action upon all these entities should compute with all these specific components and most of the business logic should be relevant to most of the entities. It is an anti-pattern to lean substantially on case logic in systems, hinting at suboptimal component definition. We should have some sense that transformations should create or modify entities and components outside of that initial filtering in order for change to propagate. It is an anti-pattern to transform the same component states multiple times in a single pass, leading to hidden states.

