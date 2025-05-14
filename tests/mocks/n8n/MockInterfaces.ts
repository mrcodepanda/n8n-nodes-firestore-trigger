import { ITriggerFunctions } from 'n8n-workflow';

/**
 * Creates a mock ITriggerFunctions object for testing
 * This mocks the n8n trigger functions interface for unit tests
 */
export function createMockTriggerFunctions(): ITriggerFunctions {
  return {
    // Core properties from FunctionsBase
    logger: {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
      verbose: jest.fn(),
      warn: jest.fn()
    },
    getCredentials: jest.fn().mockResolvedValue({}),
    getCredentialsProperties: jest.fn().mockReturnValue([]),
    getExecutionId: jest.fn().mockReturnValue('mock-execution-id'),
    getNode: jest.fn().mockReturnValue({ 
      id: 'test-node', 
      name: 'Test Node', 
      type: 'firestoreTrigger', 
      typeVersion: 1, 
      position: [0, 0], 
      parameters: {} 
    }),
    getWorkflow: jest.fn().mockReturnValue({ 
      id: 'test-workflow', 
      name: 'Test Workflow', 
      active: true 
    }),
    getWorkflowStaticData: jest.fn().mockReturnValue({}),
    getTimezone: jest.fn().mockReturnValue('UTC'),
    getRestApiUrl: jest.fn().mockReturnValue('http://localhost:5678/api'),
    getInstanceBaseUrl: jest.fn().mockReturnValue('http://localhost:5678'),
    getInstanceId: jest.fn().mockReturnValue('mock-instance-id'),
    getMode: jest.fn().mockReturnValue('trigger'),
    getActivationMode: jest.fn().mockReturnValue('activate'),
    prepareOutputData: jest.fn().mockImplementation((data) => Promise.resolve([data])),
    getChildNodes: jest.fn().mockReturnValue([]),
    getParentNodes: jest.fn().mockReturnValue([]),
    getKnownNodeTypes: jest.fn().mockReturnValue({}),
    
    // From ITriggerFunctions
    emit: jest.fn(),
    emitError: jest.fn(),
    getNodeParameter: jest.fn(),
    helpers: {
      httpRequest: jest.fn().mockResolvedValue({}),
      httpRequestWithAuthentication: jest.fn().mockResolvedValue({}),
      request: jest.fn().mockResolvedValue({}),
      requestWithAuthentication: jest.fn().mockResolvedValue({}),
      requestOAuth1: jest.fn().mockResolvedValue({}),
      requestOAuth2: jest.fn().mockResolvedValue({}),
      requestWithAuthenticationPaginated: jest.fn().mockResolvedValue([]),
      createDeferredPromise: jest.fn().mockImplementation(() => {
        const promise = Promise.resolve();
        (promise as any).resolve = () => {};
        (promise as any).reject = () => {};
        return promise;
      }),
      returnJsonArray: jest.fn().mockImplementation((items) => items),
      prepareBinaryData: jest.fn().mockResolvedValue({}),
      setBinaryDataBuffer: jest.fn().mockResolvedValue({}),
      copyBinaryFile: jest.fn(),
      binaryToBuffer: jest.fn().mockResolvedValue(Buffer.from([])),
      getBinaryPath: jest.fn().mockReturnValue('/tmp/file.txt'),
      getBinaryStream: jest.fn(),
      getBinaryMetadata: jest.fn().mockResolvedValue({ fileSize: 0 }),
    }
  } as unknown as ITriggerFunctions;
}
