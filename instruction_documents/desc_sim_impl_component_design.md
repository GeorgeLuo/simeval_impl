## Component Design

The vocabulary we’ll use to describe components:

* Type: the component type matched by the class name of a component, like a literal name of a field  
* Value: the internal payload of data captured by a specific component instance, with a defined schema

Typing internal to the payload of components is an anti-pattern, being impossible to index by the ECS engine. The schema of component values being multi-parameter is an anti-pattern for the same reason. For the same amount of information captured for an entity, it is better to have more components with less data per component than to have fewer components with more data.

