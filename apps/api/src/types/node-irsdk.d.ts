/**
 * Type declarations for node-irsdk
 * The node-irsdk package doesn't include TypeScript definitions
 */

declare module 'node-irsdk' {
  export function init(options?: any): any;
  export const getInstance: () => any;
  // Add more specific types as needed when implementing
}
