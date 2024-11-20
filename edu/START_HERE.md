# Learning the dependency injector

The contents of this directory are intended to help you deeply understand the
injector implemented in this repository. The sub directories are as follows:

- `v0` discusses our injector's interface, particularly the `inject` function.
- `v1` is our first injector (just cached singletons)
- `v2` adds providers and overrides
- `v3` adds parentage (with limitations)
- `v4` resolves the limitations of `v3`
- `v5` significantly improves the performance of `v4`

Each directory has an implementation of the injector, up to that stage of
functionality, and a `.md` file discussing the concerns that implementation
addresses (and how). There is also a test file to prove that each implementation
does what its setting out to do.

I hope this is instructive for you. Thanks for reading.
