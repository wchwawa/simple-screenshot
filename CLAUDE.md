This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation

- The project documentations are locate at `@/docs/*`
- Use `project-specification-en.md` as primary specification guideline
- The project will solo by myself, so please plan simply, get right to the point, do not need worry too much about quality attributes

## Development philosophy

- Ship the simplest thing that demonstrates value.
- Do not over-engineering at current stage, focus on implementing the core functionality and features.
- Avoid O(n²) algos on unbounded inputs
- Reasonable DB indexes, avoid unnecessary indexes
- Invest early in security, auth, and data model clarity—those rewrites hurt the most.
- it is CRUCIAL that refering document while solving complex issues and tasks.


## mcp servers as tools
- Use Context7 to check official documentation when working with libraries