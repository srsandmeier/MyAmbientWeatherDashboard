import { useContext } from 'react';
import { UNSAFE_DataRouterContext } from 'react-router';

/** Returns true when rendered inside a react-router data router (always true in the app, false in unit tests). */
export function useHasDataRouter(): boolean {
  return useContext(UNSAFE_DataRouterContext) !== null;
}
