# React Performance Notes

## React.memo

React.memo is a higher order component that memoizes your component. It will only re-render if the props have changed. Use it when a child component receives stable props but the parent re-renders often.

## useMemo

useMemo returns a memoized value. It recalculates only when dependencies change. Use it for expensive computations inside a component, not for preventing component re-renders.

## Few-shot prompting

Few-shot prompting supplies the model with example inputs and outputs so it learns the pattern you want. Place examples in the system prompt for consistent behavior across requests.

## Structured outputs

Structured outputs force the model to return JSON that matches a schema. This removes fragile regex parsing and guarantees valid, typed responses for API clients.
