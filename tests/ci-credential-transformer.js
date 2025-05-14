/**
 * This is a simple no-op transformer that passes through the source code
 * Jest uses this file as the transformer, but we'll let ts-jest handle the 
 * actual transformation through the standard Jest configuration
 */

module.exports = {
  process(src) {
    // Just return the source as is - let Jest handle the transformation
    return { code: src };
  }
};
