import { vi, expect } from 'vitest';
import { type Request, type Response, type NextFunction } from 'express';

// Create mock Express request
export function createMockRequest(data: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    ...data,
  } as Request;
}

// Create mock Express response
export function createMockResponse(): {
  res: Response;
  statusSpy: ReturnType<typeof vi.fn>;
  jsonSpy: ReturnType<typeof vi.fn>;
  sendSpy: ReturnType<typeof vi.fn>;
} {
  const res = {} as Response;

  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);

  return {
    res,
    statusSpy: res.status as unknown as ReturnType<typeof vi.fn>,
    jsonSpy: res.json as unknown as ReturnType<typeof vi.fn>,
    sendSpy: res.send as unknown as ReturnType<typeof vi.fn>,
  };
}

// Create mock Next function
export function createMockNext(): NextFunction & ReturnType<typeof vi.fn> {
  return vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
}

// Helper to assert response status and message
export function assertResponse(
  statusSpy: ReturnType<typeof vi.fn>,
  jsonSpy: ReturnType<typeof vi.fn>,
  expectedStatus: number,
  expectedMessage?: string,
): void {
  expect(statusSpy).toHaveBeenCalledWith(expectedStatus);

  if (expectedMessage) {
    const jsonCall = jsonSpy.mock.calls[0][0];
    expect(jsonCall).toHaveProperty('message', expectedMessage);
  }
}

// Helper function to create test case with two primary factors
function createTestCaseWithTwoFactors(
  factorNames: string[],
  factorValues: any[][],
  val1: any,
  val2: any,
): Record<string, any> {
  const testCase: Record<string, any> = {};
  testCase[factorNames[0]] = val1;
  testCase[factorNames[1]] = val2;

  // Set remaining factors to first value
  for (let i = 2; i < factorNames.length; i++) {
    testCase[factorNames[i]] = factorValues[i][0];
  }

  return testCase;
}

// Helper function to create test case with additional factors
function createTestCaseWithAdditionalFactor(
  factorNames: string[],
  factorValues: any[][],
  factorIndex: number,
  valueIndex: number,
  factor1Values: any[],
): Record<string, any> {
  const testCase: Record<string, any> = {};
  testCase[factorNames[0]] = factor1Values[valueIndex % factor1Values.length];
  testCase[factorNames[factorIndex]] = factorValues[factorIndex][valueIndex];

  // Set other factors to first value
  for (let k = 1; k < factorNames.length; k++) {
    if (k !== factorIndex) {
      testCase[factorNames[k]] = factorValues[k][0];
    }
  }

  return testCase;
}

// Helper to create orthogonal array test data
export function generateOrthogonalTestCases<T>(factors: Record<string, any[]>): T[] {
  const factorNames = Object.keys(factors);
  const factorValues = Object.values(factors);
  const testCases: T[] = [];

  // Generate combinations of first two factors
  const factor1Values = factorValues[0];
  const factor2Values = factorValues[1];

  // Add test cases for first two factors
  for (const val1 of factor1Values) {
    for (const val2 of factor2Values) {
      const testCase = createTestCaseWithTwoFactors(factorNames, factorValues, val1, val2);
      testCases.push(testCase as T);
    }
  }

  // Add test cases for additional factors
  for (let i = 2; i < factorNames.length; i++) {
    for (let j = 1; j < factorValues[i].length; j++) {
      const testCase = createTestCaseWithAdditionalFactor(
        factorNames,
        factorValues,
        i,
        j,
        factor1Values,
      );
      testCases.push(testCase as T);
    }
  }

  return testCases;
}
